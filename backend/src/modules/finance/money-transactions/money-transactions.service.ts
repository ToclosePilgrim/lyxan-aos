import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  MoneyTransactionStatus,
  Prisma,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';

@Injectable()
export class MoneyTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  async create(input: {
    accountId: string;
    occurredAt: Date;
    direction: MoneyTransactionDirection;
    amount: Prisma.Decimal | string | number;
    currency: string;
    description?: string;
    counterpartyId?: string;
    cashflowCategoryId?: string;
    sourceType: MoneyTransactionSourceType;
    sourceId?: string;
    idempotencyKey: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = input.tx ?? this.prisma;
    const account = await client.financialAccount.findUnique({
      where: { id: input.accountId },
      select: { id: true, currency: true },
    });
    if (!account) throw new NotFoundException('FinancialAccount not found');

    const currency = (input.currency ?? '').toUpperCase().trim();
    if (!currency || currency.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    if (currency !== account.currency.toUpperCase()) {
      throw new BadRequestException('currency must match account.currency');
    }

    const idempotencyKey = (input.idempotencyKey ?? '').trim();
    if (!idempotencyKey) {
      throw new BadRequestException('idempotencyKey is required');
    }

    // Idempotency: return existing without any update
    const existing = await client.moneyTransaction.findUnique({
      where: {
        accountId_idempotencyKey: {
          accountId: input.accountId,
          idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount must be > 0');
    }

    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurredAt is invalid');
    }

    const amountBase = await this.currencyRates.convertToBase({
      amount,
      currency,
      date: occurredAt,
    });

    const cashflowCategoryId = (input.cashflowCategoryId ?? '').trim() || null;
    if (cashflowCategoryId) {
      const cf = await client.cashflowCategory.findUnique({
        where: { id: cashflowCategoryId },
        select: { id: true },
      });
      if (!cf) throw new BadRequestException('CashflowCategory not found');
    }

    try {
      return await client.moneyTransaction.create({
        data: {
          id: crypto.randomUUID(),
          accountId: input.accountId,
          occurredAt,
          direction: input.direction,
          amount,
          currency,
          amountBase,
          description: input.description ?? null,
          counterpartyId: input.counterpartyId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          cashflowCategoryId,
          idempotencyKey,
          status: MoneyTransactionStatus.POSTED,
        },
      });
    } catch (e: any) {
      // Handle races by returning existing on unique violation
      if (e?.code === 'P2002') {
        const again = await client.moneyTransaction.findUnique({
          where: {
            accountId_idempotencyKey: {
              accountId: input.accountId,
              idempotencyKey,
            },
          },
        });
        if (again) return again;
        throw new ConflictException('Duplicate idempotencyKey for account');
      }
      throw e;
    }
  }

  async createInternalTransfer(input: {
    fromAccountId: string;
    toAccountId: string;
    amount: Prisma.Decimal | string | number;
    occurredAt: Date;
    idempotencyKeyGroup: string;
    description?: string;
  }) {
    const groupKey = (input.idempotencyKeyGroup ?? '').trim();
    if (!groupKey) {
      throw new BadRequestException('idempotencyKeyGroup is required');
    }

    const [from, to] = await Promise.all([
      this.prisma.financialAccount.findUnique({
        where: { id: input.fromAccountId },
        select: { id: true, currency: true },
      }),
      this.prisma.financialAccount.findUnique({
        where: { id: input.toAccountId },
        select: { id: true, currency: true },
      }),
    ]);
    if (!from) throw new NotFoundException('fromAccount not found');
    if (!to) throw new NotFoundException('toAccount not found');
    if (from.currency.toUpperCase() !== to.currency.toUpperCase()) {
      throw new BadRequestException('Internal transfer requires same currency');
    }

    const transferGroupId = crypto.randomUUID();
    const occurredAt = new Date(input.occurredAt);

    const { outTx, inTx } = await this.prisma.$transaction(async (tx) => {
      // Default CF category for internal transfers (can be overridden later via mapping/API)
      const defaultCf = await tx.cashflowCategory.findFirst({
        where: { code: 'CF_TRANSFER_INTERNAL', isActive: true } as any,
        orderBy: [{ code: 'asc' }],
      });
      const outTx = await this.create({
        tx,
        accountId: from.id,
        occurredAt,
        direction: MoneyTransactionDirection.OUT,
        amount: input.amount,
        currency: from.currency,
        description: input.description,
        cashflowCategoryId: defaultCf?.id,
        sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
        sourceId: transferGroupId,
        idempotencyKey: `${groupKey}:out`,
      });
      const inTx = await this.create({
        tx,
        accountId: to.id,
        occurredAt,
        direction: MoneyTransactionDirection.IN,
        amount: input.amount,
        currency: to.currency,
        description: input.description,
        cashflowCategoryId: defaultCf?.id,
        sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
        sourceId: transferGroupId,
        idempotencyKey: `${groupKey}:in`,
      });
      return { outTx, inTx };
    });

    return { transferGroupId, outTx, inTx };
  }

  async listAccountTransactions(params: {
    accountId: string;
    from?: Date;
    to?: Date;
  }) {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: params.accountId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('FinancialAccount not found');

    const where: Prisma.MoneyTransactionWhereInput = {
      accountId: params.accountId,
      status: MoneyTransactionStatus.POSTED,
    };
    if (params.from || params.to) {
      (where as any).occurredAt = {};
      if (params.from) (where as any).occurredAt.gte = params.from;
      if (params.to) (where as any).occurredAt.lte = params.to;
    }

    return this.prisma.moneyTransaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getAccountBalance(params: { accountId: string; atDate?: Date }) {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: params.accountId },
      select: { id: true, currency: true },
    });
    if (!account) throw new NotFoundException('FinancialAccount not found');

    const at = params.atDate ? new Date(params.atDate) : new Date();

    const baseWhere: Prisma.MoneyTransactionWhereInput = {
      accountId: params.accountId,
      status: MoneyTransactionStatus.POSTED,
      occurredAt: { lte: at },
    };

    const [inAgg, outAgg] = await Promise.all([
      this.prisma.moneyTransaction.aggregate({
        where: { ...baseWhere, direction: MoneyTransactionDirection.IN },
        _sum: { amount: true },
      }),
      this.prisma.moneyTransaction.aggregate({
        where: { ...baseWhere, direction: MoneyTransactionDirection.OUT },
        _sum: { amount: true },
      }),
    ]);

    const inSum = inAgg._sum.amount ?? new Prisma.Decimal(0);
    const outSum = outAgg._sum.amount ?? new Prisma.Decimal(0);
    const balance = inSum.sub(outSum);

    return {
      accountId: account.id,
      currency: account.currency,
      at,
      balance,
    };
  }
}
