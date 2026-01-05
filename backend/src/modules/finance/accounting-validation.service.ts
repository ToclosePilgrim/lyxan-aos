import { Injectable } from '@nestjs/common';
import { AccountingDocType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export class AccountingUnbalancedException extends Error {
  constructor(
    message: string,
    public readonly details: {
      docType: AccountingDocType;
      docId: string;
      currencyTotals: Array<{
        currency: string;
        totalDebit: string;
        totalCredit: string;
      }>;
      topDebitAccounts: Array<{ account: string; amount: string }>;
      topCreditAccounts: Array<{ account: string; amount: string }>;
    },
  ) {
    super(message);
    this.name = 'AccountingUnbalancedException';
  }
}

export function computeDocumentBalance(
  entries: Array<{
    debitAccount: string;
    creditAccount: string;
    amount: Prisma.Decimal;
    currency: string;
  }>,
) {
  const debitTotals = new Map<string, Prisma.Decimal>();
  const creditTotals = new Map<string, Prisma.Decimal>();
  const byCurrency = new Map<
    string,
    { debit: Prisma.Decimal; credit: Prisma.Decimal }
  >();

  for (const e of entries) {
    const debit = debitTotals.get(e.debitAccount) ?? new Prisma.Decimal(0);
    debitTotals.set(e.debitAccount, debit.add(e.amount));

    const credit = creditTotals.get(e.creditAccount) ?? new Prisma.Decimal(0);
    creditTotals.set(e.creditAccount, credit.add(e.amount));

    const cur = byCurrency.get(e.currency) ?? {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };
    cur.debit = cur.debit.add(e.amount);
    cur.credit = cur.credit.add(e.amount);
    byCurrency.set(e.currency, cur);
  }

  const currencyTotals = Array.from(byCurrency.entries()).map(
    ([currency, totals]) => ({
      currency,
      totalDebit: totals.debit.toString(),
      totalCredit: totals.credit.toString(),
      isBalanced: totals.debit.eq(totals.credit),
    }),
  );

  const top = (m: Map<string, Prisma.Decimal>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1].cmp(a[1]))
      .slice(0, 10)
      .map(([account, amount]) => ({ account, amount: amount.toString() }));

  return {
    currencyTotals,
    topDebitAccounts: top(debitTotals),
    topCreditAccounts: top(creditTotals),
  };
}

export function assertDoubleEntryInvariants(params: {
  docType: AccountingDocType;
  docId: string;
  entries: Array<{
    debitAccount: string;
    creditAccount: string;
    amount: Prisma.Decimal;
    currency: string;
  }>;
}) {
  for (const e of params.entries) {
    if (!e.debitAccount || !e.creditAccount) {
      throw new AccountingUnbalancedException(
        `Accounting entry is missing debit/credit for ${params.docType}:${params.docId}`,
        {
          docType: params.docType,
          docId: params.docId,
          currencyTotals: [],
          topDebitAccounts: [],
          topCreditAccounts: [],
        },
      );
    }
    if (e.amount.lte(0)) {
      throw new AccountingUnbalancedException(
        `Accounting entry amount must be > 0 for ${params.docType}:${params.docId}`,
        {
          docType: params.docType,
          docId: params.docId,
          currencyTotals: [],
          topDebitAccounts: [],
          topCreditAccounts: [],
        },
      );
    }
  }
}

@Injectable()
export class AccountingValidationService {
  constructor(private readonly prisma: PrismaService) {}

  private isValidateOnPostEnabled(): boolean {
    const raw = process.env.ACCOUNTING_VALIDATE_ON_POST;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    // default: enabled in non-production
    return process.env.NODE_ENV !== 'production';
  }

  async validateDocumentBalance(params: {
    docType: AccountingDocType;
    docId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    const entries = await client.accountingEntry.findMany({
      where: { docType: params.docType, docId: params.docId },
      select: {
        debitAccount: true,
        creditAccount: true,
        amount: true,
        currency: true,
      },
      orderBy: { lineNumber: 'asc' },
    });

    const normalized = entries.map((e) => ({
      debitAccount: e.debitAccount,
      creditAccount: e.creditAccount,
      amount: new Prisma.Decimal(e.amount),
      currency: e.currency,
    }));
    assertDoubleEntryInvariants({
      docType: params.docType,
      docId: params.docId,
      entries: normalized,
    });

    const balance = computeDocumentBalance(normalized);

    const unbalanced = balance.currencyTotals.find((t) => !t.isBalanced);
    if (unbalanced) {
      throw new AccountingUnbalancedException(
        `Accounting is unbalanced for ${params.docType}:${params.docId} (currency=${unbalanced.currency})`,
        {
          docType: params.docType,
          docId: params.docId,
          currencyTotals: balance.currencyTotals.map((t) => ({
            currency: t.currency,
            totalDebit: t.totalDebit,
            totalCredit: t.totalCredit,
          })),
          topDebitAccounts: balance.topDebitAccounts,
          topCreditAccounts: balance.topCreditAccounts,
        },
      );
    }
  }

  async maybeValidateDocumentBalanceOnPost(params: {
    docType: AccountingDocType;
    docId: string;
    tx?: Prisma.TransactionClient;
  }) {
    if (!this.isValidateOnPostEnabled()) return;
    await this.validateDocumentBalance(params);
  }

  async validateBatchBalance(filter: {
    from?: Date;
    to?: Date;
    docTypes?: AccountingDocType[];
  }): Promise<{
    checkedDocuments: number;
    unbalancedDocuments: number;
    problems: Array<{
      docType: AccountingDocType;
      docId: string;
      message: string;
    }>;
  }> {
    const where: Prisma.AccountingEntryWhereInput = {};
    if (filter.from || filter.to) {
      where.postingDate = {
        gte: filter.from,
        lte: filter.to,
      };
    }
    if (filter.docTypes?.length) {
      where.docType = { in: filter.docTypes };
    }

    const docs = await this.prisma.accountingEntry.findMany({
      where,
      select: { docType: true, docId: true },
      distinct: ['docType', 'docId'],
      take: 10_000,
    });

    const problems: Array<{
      docType: AccountingDocType;
      docId: string;
      message: string;
    }> = [];
    for (const d of docs) {
      try {
        await this.validateDocumentBalance({
          docType: d.docType,
          docId: d.docId,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        problems.push({ docType: d.docType, docId: d.docId, message });
      }
    }

    return {
      checkedDocuments: docs.length,
      unbalancedDocuments: problems.length,
      problems,
    };
  }
}
