import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

type TxAggRow = {
  cashflowCategoryId: string | null;
  inflow: Prisma.Decimal;
  outflow: Prisma.Decimal;
  count: bigint | number;
};

@Injectable()
export class CashflowReportService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfDay(d: Date): Date {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private endOfDay(d: Date): Date {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
  }

  private parseDate(s: string, label: string): Date {
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException(`${label} is invalid`);
    return d;
  }

  private cashAccountTypes(): FinancialAccountType[] {
    return [
      FinancialAccountType.BANK_ACCOUNT,
      (FinancialAccountType as any).CASH_REGISTER ??
        FinancialAccountType.CASHBOX,
      FinancialAccountType.ACQUIRING_ACCOUNT,
      FinancialAccountType.MARKETPLACE_WALLET,
      (FinancialAccountType as any).OTHER_CASHLIKE,
    ].filter(Boolean) as any;
  }

  private buildCategoryMaps(categories: any[]) {
    const byId = new Map<string, any>();
    for (const c of categories) byId.set(c.id, c);

    const topOf = (id: string): any => {
      let cur = byId.get(id);
      let guard = 0;
      while (cur?.parentId && guard++ < 50) {
        const next = byId.get(cur.parentId);
        if (!next) break;
        cur = next;
      }
      return cur ?? byId.get(id);
    };

    const pathOf = (id: string): string[] => {
      const path: string[] = [];
      let cur = byId.get(id);
      let guard = 0;
      while (cur && guard++ < 50) {
        path.unshift(cur.name);
        if (!cur.parentId) break;
        cur = byId.get(cur.parentId);
      }
      return path;
    };

    return { byId, topOf, pathOf };
  }

  async getCashflow(params: {
    legalEntityId: string;
    from: string;
    to: string;
    groupBy: 'category' | 'topLevelCategory';
    includeTransfers: boolean;
  }) {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const from = this.startOfDay(this.parseDate(params.from, 'from'));
    const to = this.endOfDay(this.parseDate(params.to, 'to'));
    if (to < from) throw new BadRequestException('to must be >= from');

    // cash-like accounts
    const cashAccounts = await this.prisma.financialAccount.findMany({
      where: {
        legalEntityId,
        type: { in: this.cashAccountTypes() } as any,
      } as any,
      select: { id: true, name: true, currency: true, type: true },
      orderBy: [{ name: 'asc' }],
    });
    const accountIds = cashAccounts.map((a) => a.id);

    // Reconciliation totals always include ALL transactions on cash-like accounts in period
    const [periodAgg] = await this.prisma.$queryRaw<
      Array<{ inflow: Prisma.Decimal; outflow: Prisma.Decimal }>
    >`
      SELECT
        COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "amountBase" ELSE 0 END), 0) AS inflow,
        COALESCE(SUM(CASE WHEN "direction" = 'OUT' THEN "amountBase" ELSE 0 END), 0) AS outflow
      FROM "money_transactions"
      WHERE "accountId" = ANY(${accountIds}::text[])
        AND "status" = 'POSTED'
        AND "occurredAt" >= ${from}
        AND "occurredAt" <= ${to}
    `;
    const inflowBase =
      (periodAgg?.inflow as any)?.toNumber?.() ??
      Number(periodAgg?.inflow ?? 0);
    const outflowBase =
      (periodAgg?.outflow as any)?.toNumber?.() ??
      Number(periodAgg?.outflow ?? 0);
    const txNetBase = inflowBase - outflowBase;

    // Cash balances at start/end (sum of all prior tx for each cash account)
    const startAt = new Date(from);
    startAt.setMilliseconds(-1); // strictly before start day
    const endAt = to;

    const startRows = await this.prisma.$queryRaw<
      Array<{ accountId: string; balance: Prisma.Decimal }>
    >`
      SELECT "accountId",
             COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "amountBase" ELSE -"amountBase" END), 0) AS balance
      FROM "money_transactions"
      WHERE "accountId" = ANY(${accountIds}::text[])
        AND "status" = 'POSTED'
        AND "occurredAt" <= ${startAt}
      GROUP BY "accountId"
    `;
    const endRows = await this.prisma.$queryRaw<
      Array<{ accountId: string; balance: Prisma.Decimal }>
    >`
      SELECT "accountId",
             COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "amountBase" ELSE -"amountBase" END), 0) AS balance
      FROM "money_transactions"
      WHERE "accountId" = ANY(${accountIds}::text[])
        AND "status" = 'POSTED'
        AND "occurredAt" <= ${endAt}
      GROUP BY "accountId"
    `;
    const startMap = new Map<string, number>(
      startRows.map((r: any) => [
        r.accountId,
        r.balance?.toNumber?.() ?? Number(r.balance ?? 0),
      ]),
    );
    const endMap = new Map<string, number>(
      endRows.map((r: any) => [
        r.accountId,
        r.balance?.toNumber?.() ?? Number(r.balance ?? 0),
      ]),
    );

    const byAccount = cashAccounts.map((a) => {
      const startBase = startMap.get(a.id) ?? 0;
      const endBase = endMap.get(a.id) ?? 0;
      return {
        accountId: a.id,
        name: a.name,
        currency: a.currency,
        startBase,
        endBase,
        deltaBase: endBase - startBase,
      };
    });
    const cashStartBase = byAccount.reduce((s, a) => s + a.startBase, 0);
    const cashEndBase = byAccount.reduce((s, a) => s + a.endBase, 0);
    const cashDeltaBase = cashEndBase - cashStartBase;

    const tolerance = 0.01;
    const delta = cashDeltaBase - txNetBase;

    // Category breakdown (optionally exclude transfer categories)
    const categories = await this.prisma.cashflowCategory.findMany({
      where: { isActive: true } as any,
      select: { id: true, name: true, parentId: true, isTransfer: true },
    });
    const { byId, topOf, pathOf } = this.buildCategoryMaps(categories);

    const txAgg = await this.prisma.$queryRaw<TxAggRow[]>`
      SELECT
        "cashflowCategoryId" AS "cashflowCategoryId",
        COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "amountBase" ELSE 0 END), 0) AS inflow,
        COALESCE(SUM(CASE WHEN "direction" = 'OUT' THEN "amountBase" ELSE 0 END), 0) AS outflow,
        COUNT(*)::bigint AS count
      FROM "money_transactions"
      WHERE "accountId" = ANY(${accountIds}::text[])
        AND "status" = 'POSTED'
        AND "occurredAt" >= ${from}
        AND "occurredAt" <= ${to}
      GROUP BY "cashflowCategoryId"
    `;

    const buckets = new Map<
      string,
      {
        cashflowCategoryId: string;
        name: string;
        path: string[];
        inflowBase: number;
        outflowBase: number;
        netBase: number;
        count: number;
      }
    >();

    for (const r of txAgg) {
      const catId = r.cashflowCategoryId ? String(r.cashflowCategoryId) : null;
      if (!catId) continue; // should not happen for manual/exec, but ignore
      const cat = byId.get(catId);
      if (!cat) continue;
      if (!params.includeTransfers && cat.isTransfer) continue;

      const bucketCat =
        params.groupBy === 'topLevelCategory' ? topOf(catId) : cat;
      const bucketId = bucketCat.id;
      const inflow =
        (r as any).inflow?.toNumber?.() ?? Number((r as any).inflow ?? 0);
      const outflow =
        (r as any).outflow?.toNumber?.() ?? Number((r as any).outflow ?? 0);
      const count = Number((r as any).count ?? 0);

      const cur = buckets.get(bucketId) ?? {
        cashflowCategoryId: bucketId,
        name: bucketCat.name,
        path: pathOf(bucketId),
        inflowBase: 0,
        outflowBase: 0,
        netBase: 0,
        count: 0,
      };
      cur.inflowBase += inflow;
      cur.outflowBase += outflow;
      cur.netBase += inflow - outflow;
      cur.count += count;
      buckets.set(bucketId, cur);
    }

    const byCategory = Array.from(buckets.values()).sort(
      (a, b) => b.netBase - a.netBase,
    );

    return {
      legalEntityId,
      from: from.toISOString(),
      to: to.toISOString(),
      currency: 'BASE',
      totals: {
        inflowBase,
        outflowBase,
        netBase: txNetBase,
      },
      byCategory,
      reconciliation: {
        cashStartBase,
        cashEndBase,
        cashDeltaBase,
        txNetBase,
        delta,
        isReconciled: Math.abs(delta) <= tolerance,
        tolerance,
      },
      byAccount,
    };
  }

  async explainCategory(params: {
    legalEntityId: string;
    from: string;
    to: string;
    cashflowCategoryId: string;
    limit?: number;
    offset?: number;
  }) {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const from = this.startOfDay(this.parseDate(params.from, 'from'));
    const to = this.endOfDay(this.parseDate(params.to, 'to'));
    if (to < from) throw new BadRequestException('to must be >= from');
    const cashflowCategoryId = (params.cashflowCategoryId ?? '').trim();
    if (!cashflowCategoryId)
      throw new BadRequestException('cashflowCategoryId is required');

    const cashAccounts = await this.prisma.financialAccount.findMany({
      where: {
        legalEntityId,
        type: { in: this.cashAccountTypes() } as any,
      } as any,
      select: { id: true },
    });
    const accountIds = cashAccounts.map((a) => a.id);

    const take = Math.min(params.limit ?? 50, 200);
    const skip = params.offset ?? 0;

    const where: Prisma.MoneyTransactionWhereInput = {
      accountId: { in: accountIds },
      occurredAt: { gte: from, lte: to },
      cashflowCategoryId,
    } as any;

    const [items, total] = await Promise.all([
      this.prisma.moneyTransaction.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        include: {
          account: {
            select: { id: true, name: true, currency: true, type: true },
          },
        },
      }),
      this.prisma.moneyTransaction.count({ where }),
    ]);

    return {
      legalEntityId,
      cashflowCategoryId,
      from: from.toISOString(),
      to: to.toISOString(),
      total,
      items: items.map((t: any) => ({
        id: t.id,
        occurredAt: t.occurredAt,
        direction: t.direction as MoneyTransactionDirection,
        amountBase: t.amountBase?.toNumber?.() ?? Number(t.amountBase ?? 0),
        currency: t.currency,
        description: t.description ?? null,
        sourceType: t.sourceType,
        sourceId: t.sourceId ?? null,
        account: t.account,
      })),
    };
  }
}
