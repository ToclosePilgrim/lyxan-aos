import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashAccountingLinkRole, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CashAccountingLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async link(input: {
    moneyTransactionId: string;
    accountingEntryId: string;
    role: CashAccountingLinkRole;
    tx?: Prisma.TransactionClient;
  }) {
    const client = input.tx ?? this.prisma;

    const [mt, entry] = await Promise.all([
      client.moneyTransaction.findUnique({
        where: { id: input.moneyTransactionId },
        select: { id: true },
      }),
      client.accountingEntry.findUnique({
        where: { id: input.accountingEntryId },
        select: { id: true },
      }),
    ]);
    if (!mt) throw new NotFoundException('MoneyTransaction not found');
    if (!entry) throw new NotFoundException('AccountingEntry not found');

    // Idempotent by unique(moneyTransactionId, accountingEntryId, role)
    return client.cashAccountingLink.upsert({
      where: {
        moneyTransactionId_accountingEntryId_role: {
          moneyTransactionId: input.moneyTransactionId,
          accountingEntryId: input.accountingEntryId,
          role: input.role,
        },
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        moneyTransactionId: input.moneyTransactionId,
        accountingEntryId: input.accountingEntryId,
        role: input.role,
      },
    });
  }

  async listByMoneyTransaction(moneyTransactionId: string) {
    return this.prisma.cashAccountingLink.findMany({
      where: { moneyTransactionId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        accountingEntry: true,
      },
    });
  }

  async listByAccountingEntry(accountingEntryId: string) {
    return this.prisma.cashAccountingLink.findMany({
      where: { accountingEntryId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        moneyTransaction: true,
      },
    });
  }

  async unlink(params: {
    moneyTransactionId: string;
    accountingEntryId: string;
    role: CashAccountingLinkRole;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    await client.cashAccountingLink.deleteMany({
      where: {
        moneyTransactionId: params.moneyTransactionId,
        accountingEntryId: params.accountingEntryId,
        role: params.role,
      },
    });
    return { success: true };
  }

  async unlinkByMoneyTransaction(params: {
    moneyTransactionId: string;
    role: CashAccountingLinkRole;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    const res = await client.cashAccountingLink.deleteMany({
      where: {
        moneyTransactionId: params.moneyTransactionId,
        role: params.role,
      },
    });
    return { success: true, deleted: res.count };
  }
}
