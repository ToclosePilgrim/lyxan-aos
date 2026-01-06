import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { AccountingDocType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AccountingBalanceErrorDetails = {
  docType: AccountingDocType;
  docId: string;
  postingRunId?: string;
  base: {
    debitSum: string;
    creditSum: string;
    difference: string;
  };
  currencies: Array<{
    currency: string;
    debitSum: string;
    creditSum: string;
    difference: string;
  }>;
  topDebitAccounts: Array<{ account: string; amountBase: string }>;
  topCreditAccounts: Array<{ account: string; amountBase: string }>;
};

export function computeDocumentBalance(
  entries: Array<{
    debitAccount: string;
    creditAccount: string;
    amountBase: Prisma.Decimal;
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
    const cur = byCurrency.get(e.currency) ?? {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };

    if (e.debitAccount) {
      const debit = debitTotals.get(e.debitAccount) ?? new Prisma.Decimal(0);
      debitTotals.set(e.debitAccount, debit.add(e.amountBase));
      cur.debit = cur.debit.add(e.amountBase);
    }
    if (e.creditAccount) {
      const credit = creditTotals.get(e.creditAccount) ?? new Prisma.Decimal(0);
      creditTotals.set(e.creditAccount, credit.add(e.amountBase));
      cur.credit = cur.credit.add(e.amountBase);
    }

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
    amountBase: Prisma.Decimal;
    currency: string;
  }>;
}) {
  for (const e of params.entries) {
    if (!e.debitAccount || !e.creditAccount) {
      throw new UnprocessableEntityException({
        message: `Accounting entry is missing debit/credit for ${params.docType}:${params.docId}`,
        docType: params.docType,
        docId: params.docId,
      });
    }
    if (e.amountBase.lte(0)) {
      throw new UnprocessableEntityException({
        message: `Accounting entry amountBase must be > 0 for ${params.docType}:${params.docId}`,
        docType: params.docType,
        docId: params.docId,
      });
    }
  }
}

@Injectable()
export class AccountingValidationService {
  private readonly logger = new Logger(AccountingValidationService.name);
  constructor(private readonly prisma: PrismaService) {}

  private isValidateOnPostEnabled(): boolean {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    // TZ 7: ALWAYS ON in production (prod-safe)
    if (nodeEnv === 'production') return true;
    // In dev/test, allow override, but default ON
    const raw = process.env.ACCOUNTING_VALIDATE_ON_POST;
    if (raw === 'false') return false;
    return true;
  }

  async validateDocumentBalance(params: {
    docType: AccountingDocType;
    docId: string;
    postingRunId?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    const entries = await client.accountingEntry.findMany({
      where: params.postingRunId
        ? ({ postingRunId: params.postingRunId } as any)
        : ({ docType: params.docType, docId: params.docId } as any),
      select: {
        debitAccount: true,
        creditAccount: true,
        amountBase: true,
        currency: true,
      },
      orderBy: { lineNumber: 'asc' },
    });

    // Empty set is trivially balanced (0 == 0). Some flows may legitimately produce no entries.
    if (!entries.length) return;

    const normalized = entries.map((e) => ({
      debitAccount: e.debitAccount,
      creditAccount: e.creditAccount,
      amountBase: new Prisma.Decimal(e.amountBase),
      currency: e.currency,
    }));
    const balance = computeDocumentBalance(normalized);
    const totalDebit = balance.currencyTotals.reduce(
      (acc, t) => acc.add(new Prisma.Decimal(t.totalDebit)),
      new Prisma.Decimal(0),
    );
    const totalCredit = balance.currencyTotals.reduce(
      (acc, t) => acc.add(new Prisma.Decimal(t.totalCredit)),
      new Prisma.Decimal(0),
    );
    const totalDiff = totalDebit.sub(totalCredit);

    // Invariants may fail for malformed rows (missing debit/credit/amountBase <= 0).
    // We still want to return a strict 422 with document totals.
    try {
      assertDoubleEntryInvariants({
        docType: params.docType,
        docId: params.docId,
        entries: normalized,
      });
    } catch (e: any) {
      const details: AccountingBalanceErrorDetails = {
        docType: params.docType,
        docId: params.docId,
        postingRunId: params.postingRunId,
        base: {
          debitSum: totalDebit.toString(),
          creditSum: totalCredit.toString(),
          difference: totalDiff.toString(),
        },
        currencies: balance.currencyTotals.map((t) => ({
          currency: t.currency,
          debitSum: t.totalDebit,
          creditSum: t.totalCredit,
          difference: new Prisma.Decimal(t.totalDebit)
            .sub(new Prisma.Decimal(t.totalCredit))
            .toString(),
        })),
        topDebitAccounts: balance.topDebitAccounts.map((x) => ({
          account: x.account,
          amountBase: x.amount,
        })),
        topCreditAccounts: balance.topCreditAccounts.map((x) => ({
          account: x.account,
          amountBase: x.amount,
        })),
      };
      this.logger.error('Accounting validation failed: invariants', details as any);
      throw new UnprocessableEntityException({
        message: e?.response?.message ?? e?.message ?? 'Accounting invariant violation',
        ...details,
      });
    }

    if (!totalDiff.isZero()) {
      const details: AccountingBalanceErrorDetails = {
        docType: params.docType,
        docId: params.docId,
        postingRunId: params.postingRunId,
        base: {
          debitSum: totalDebit.toString(),
          creditSum: totalCredit.toString(),
          difference: totalDiff.toString(),
        },
        currencies: balance.currencyTotals.map((t) => ({
          currency: t.currency,
          debitSum: t.totalDebit,
          creditSum: t.totalCredit,
          difference: new Prisma.Decimal(t.totalDebit)
            .sub(new Prisma.Decimal(t.totalCredit))
            .toString(),
        })),
        topDebitAccounts: balance.topDebitAccounts.map((x) => ({
          account: x.account,
          amountBase: x.amount,
        })),
        topCreditAccounts: balance.topCreditAccounts.map((x) => ({
          account: x.account,
          amountBase: x.amount,
        })),
      };
      this.logger.error('Accounting validation failed: unbalanced', details as any);
      throw new UnprocessableEntityException({
        message: `Accounting is unbalanced for ${params.docType}:${params.docId}`,
        ...details,
      });
    }
  }

  async maybeValidateDocumentBalanceOnPost(params: {
    docType: AccountingDocType;
    docId: string;
    postingRunId?: string;
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
