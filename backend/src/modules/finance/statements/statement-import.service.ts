import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MoneyTransactionDirection,
  Prisma,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';

function normalizeText(s?: string | null): string {
  return (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',')}}`;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class StatementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  computeLineHash(params: {
    occurredAt: Date;
    direction: MoneyTransactionDirection;
    amount: Prisma.Decimal;
    currency: string;
    bankReference?: string | null;
    description?: string | null;
  }): string {
    const payload = [
      params.occurredAt.toISOString(),
      params.direction,
      params.amount.toFixed(2),
      params.currency.toUpperCase(),
      normalizeText(params.bankReference),
      normalizeText(params.description),
    ].join('|');
    return sha256(payload);
  }

  computeImportHash(params: {
    accountId: string;
    provider: StatementProvider;
    sourceName?: string | null;
    periodFrom?: Date | null;
    periodTo?: Date | null;
    lines: Array<{
      occurredAt: string;
      direction: MoneyTransactionDirection;
      amount: string;
      currency: string;
      description?: string;
      bankReference?: string;
      externalLineId?: string;
      counterpartyName?: string;
      counterpartyInn?: string;
    }>;
  }): string {
    return sha256(
      stableStringify({
        accountId: params.accountId,
        provider: params.provider,
        sourceName: params.sourceName ?? null,
        periodFrom: params.periodFrom
          ? new Date(params.periodFrom).toISOString()
          : null,
        periodTo: params.periodTo
          ? new Date(params.periodTo).toISOString()
          : null,
        lines: params.lines,
      }),
    );
  }

  async import(params: {
    accountId: string;
    provider: StatementProvider;
    sourceName?: string | null;
    periodFrom?: Date | null;
    periodTo?: Date | null;
    importHash?: string | null;
    lines: Array<{
      occurredAt: Date;
      direction: MoneyTransactionDirection;
      amount: Prisma.Decimal | string | number;
      currency: string;
      description?: string | null;
      bankReference?: string | null;
      externalLineId?: string | null;
      counterpartyName?: string | null;
      counterpartyInn?: string | null;
    }>;
    raw?: any;
  }) {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: params.accountId },
      select: { id: true, legalEntityId: true, currency: true },
    });
    if (!account) throw new NotFoundException('FinancialAccount not found');

    const accountCurrency = account.currency.toUpperCase();
    const periodFrom = params.periodFrom ? new Date(params.periodFrom) : null;
    const periodTo = params.periodTo ? new Date(params.periodTo) : null;

    const importHash =
      (params.importHash ?? '').trim() ||
      this.computeImportHash({
        accountId: params.accountId,
        provider: params.provider,
        sourceName: params.sourceName ?? null,
        periodFrom,
        periodTo,
        lines: params.lines.map((l) => ({
          occurredAt: new Date(l.occurredAt).toISOString(),
          direction: l.direction,
          amount: new Prisma.Decimal(l.amount).toString(),
          currency: (l.currency ?? '').toUpperCase(),
          description: l.description ?? undefined,
          bankReference: l.bankReference ?? undefined,
          externalLineId: l.externalLineId ?? undefined,
          counterpartyName: l.counterpartyName ?? undefined,
          counterpartyInn: l.counterpartyInn ?? undefined,
        })),
      });

    if (!importHash) throw new BadRequestException('importHash is required');

    const existingStmt = await this.prisma.statement.findUnique({
      where: {
        accountId_importHash: { accountId: params.accountId, importHash },
      },
      select: { id: true },
    });
    if (existingStmt) {
      return {
        statementId: existingStmt.id,
        alreadyImported: true,
        createdLines: 0,
        skippedDuplicates: params.lines.length,
        errorsCount: 0,
      };
    }

    const errors: Array<{ index: number; message: string }> = [];
    const normalizedLines: Array<{
      lineIndex: number;
      occurredAt: Date;
      direction: MoneyTransactionDirection;
      amount: Prisma.Decimal;
      currency: string;
      amountBase: Prisma.Decimal;
      description?: string | null;
      bankReference?: string | null;
      externalLineId?: string | null;
      counterpartyName?: string | null;
      counterpartyInn?: string | null;
      lineHash: string;
    }> = [];

    for (let i = 0; i < params.lines.length; i++) {
      const l = params.lines[i];
      const occurredAt = new Date(l.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        errors.push({ index: i, message: 'occurredAt is invalid' });
        continue;
      }
      const amount = new Prisma.Decimal(l.amount);
      if (amount.lte(0)) {
        errors.push({ index: i, message: 'amount must be > 0' });
        continue;
      }
      const currency = (l.currency ?? '').toUpperCase();
      if (!currency || currency.length !== 3) {
        errors.push({
          index: i,
          message: 'currency must be a 3-letter ISO code',
        });
        continue;
      }
      if (currency !== accountCurrency) {
        throw new BadRequestException(
          'line.currency must match account.currency',
        );
      }

      const amountBase = await this.currencyRates.convertToBase({
        amount,
        currency,
        date: occurredAt,
      });

      const lineHash = this.computeLineHash({
        occurredAt,
        direction: l.direction,
        amount,
        currency,
        bankReference: l.bankReference ?? null,
        description: l.description ?? null,
      });

      normalizedLines.push({
        lineIndex: i,
        occurredAt,
        direction: l.direction,
        amount,
        currency,
        amountBase,
        description: l.description ?? null,
        bankReference: l.bankReference ?? null,
        externalLineId: l.externalLineId?.trim() || null,
        counterpartyName: l.counterpartyName ?? null,
        counterpartyInn: l.counterpartyInn ?? null,
        lineHash,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.statement.create({
        data: {
          id: crypto.randomUUID(),
          legalEntityId: account.legalEntityId,
          accountId: account.id,
          provider: params.provider,
          sourceName: params.sourceName ?? null,
          periodFrom,
          periodTo,
          importHash,
          raw: params.raw ?? null,
        } as any,
      });

      const res = await tx.statementLine.createMany({
        data: normalizedLines.map((l) => ({
          id: crypto.randomUUID(),
          statementId: statement.id,
          accountId: account.id,
          legalEntityId: account.legalEntityId,
          lineIndex: l.lineIndex,
          occurredAt: l.occurredAt,
          direction: l.direction,
          amount: l.amount,
          currency: l.currency,
          amountBase: l.amountBase,
          description: l.description ?? null,
          counterpartyName: l.counterpartyName ?? null,
          counterpartyInn: l.counterpartyInn ?? null,
          bankReference: l.bankReference ?? null,
          externalLineId: l.externalLineId ?? null,
          lineHash: l.lineHash,
          status: 'NEW' as any,
        })),
        skipDuplicates: true,
      });

      const createdLines = res.count;
      const skippedDuplicates = normalizedLines.length - createdLines;
      return {
        statementId: statement.id,
        alreadyImported: false,
        createdLines,
        skippedDuplicates,
        errorsCount: errors.length,
        errors,
      };
    });
  }
}
