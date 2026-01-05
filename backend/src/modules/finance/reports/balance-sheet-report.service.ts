import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  BALANCE_SHEET_CONFIG,
  BalanceSheetGroupConfig,
} from './balance-sheet.config';

type BalanceRow = { account: string; balance: Prisma.Decimal };

@Injectable()
export class BalanceSheetReportService {
  constructor(private readonly prisma: PrismaService) {}

  private endOfDay(d: Date): Date {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
  }

  private parseAt(at: string): Date {
    const dt = new Date(at);
    if (Number.isNaN(dt.getTime()))
      throw new BadRequestException('at is invalid');
    return this.endOfDay(dt);
  }

  private buildAccountIndex() {
    const sectionGroups: Array<{
      sectionId: 'assets' | 'liabilities' | 'equity';
      group: BalanceSheetGroupConfig;
    }> = [];
    for (const group of BALANCE_SHEET_CONFIG.assets)
      sectionGroups.push({ sectionId: 'assets', group });
    for (const group of BALANCE_SHEET_CONFIG.liabilities)
      sectionGroups.push({ sectionId: 'liabilities', group });
    for (const group of BALANCE_SHEET_CONFIG.equity)
      sectionGroups.push({ sectionId: 'equity', group });

    const accountTo = new Map<
      string,
      {
        sectionId: 'assets' | 'liabilities' | 'equity';
        groupId: string;
        groupName: string;
      }
    >();
    for (const sg of sectionGroups) {
      for (const acc of sg.group.accounts) {
        accountTo.set(acc, {
          sectionId: sg.sectionId,
          groupId: sg.group.id,
          groupName: sg.group.name,
        });
      }
    }
    return accountTo;
  }

  async getBalanceSheet(params: {
    legalEntityId: string;
    at: string;
    includeZero?: boolean;
  }) {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const at = this.parseAt(params.at);

    // native balance = sum(debit - credit) in base currency
    const rows = await this.prisma.$queryRaw<BalanceRow[]>`
      SELECT account, SUM(delta) AS balance
      FROM (
        SELECT "debitAccount" AS account, SUM("amountBase") AS delta
        FROM "AccountingEntry"
        WHERE "legalEntityId" = ${legalEntityId} AND "postingDate" <= ${at}
        GROUP BY "debitAccount"
        UNION ALL
        SELECT "creditAccount" AS account, SUM(-"amountBase") AS delta
        FROM "AccountingEntry"
        WHERE "legalEntityId" = ${legalEntityId} AND "postingDate" <= ${at}
        GROUP BY "creditAccount"
      ) t
      GROUP BY account
    `;

    const balances = new Map<string, number>();
    for (const r of rows) {
      const acc = String((r as any).account);
      const v =
        (r as any).balance?.toNumber?.() ?? Number((r as any).balance ?? 0);
      balances.set(acc, v);
    }

    const accountTo = this.buildAccountIndex();
    const includeZero = !!params.includeZero;

    const buildSection = (
      sectionId: 'assets' | 'liabilities' | 'equity',
      groups: BalanceSheetGroupConfig[],
    ) => {
      const outGroups: any[] = [];
      let total = 0;

      for (const g of groups) {
        const items: any[] = [];
        let groupTotal = 0;
        for (const acc of g.accounts) {
          const native = balances.get(acc) ?? 0;
          const normalized = sectionId === 'assets' ? native : -native;
          if (!includeZero && Math.abs(normalized) < 0.0000001) continue;
          items.push({
            accountId: acc,
            accountName: BALANCE_SHEET_CONFIG.accountNames[acc] ?? acc,
            balanceBaseNative: native,
            balanceBase: normalized,
          });
          groupTotal += normalized;
        }
        if (items.length || includeZero) {
          outGroups.push({
            id: g.id,
            name: g.name,
            items,
            totalBase: groupTotal,
          });
          total += groupTotal;
        }
      }

      return { groups: outGroups, total };
    };

    const assets = buildSection('assets', BALANCE_SHEET_CONFIG.assets);
    const liabilities = buildSection(
      'liabilities',
      BALANCE_SHEET_CONFIG.liabilities,
    );
    const equity = buildSection('equity', BALANCE_SHEET_CONFIG.equity);

    const tolerance = 0.01;
    const equationDelta = assets.total - (liabilities.total + equity.total);
    const isBalanced = Math.abs(equationDelta) <= tolerance;

    // diagnostic: top-10 accounts by abs native balance (including unmapped)
    const allAccounts = Array.from(balances.entries()).map(
      ([accountId, native]) => {
        const meta = accountTo.get(accountId);
        return {
          accountId,
          accountName:
            BALANCE_SHEET_CONFIG.accountNames[accountId] ?? accountId,
          balanceBaseNative: native,
          abs: Math.abs(native),
          sectionId: meta?.sectionId ?? null,
          groupId: meta?.groupId ?? null,
        };
      },
    );
    allAccounts.sort((a, b) => b.abs - a.abs);
    const topAccountsByAbsBalance = allAccounts
      .slice(0, 10)
      .map(({ abs, ...rest }) => rest);

    return {
      at: at.toISOString(),
      currency: 'BASE',
      legalEntityId,
      sections: {
        assets,
        liabilities,
        equity,
      },
      checks: {
        equationDelta,
        isBalanced,
        tolerance,
        topAccountsByAbsBalance,
      },
    };
  }

  async explainAccount(params: {
    legalEntityId: string;
    at: string;
    accountId: string;
    from?: string;
    limit?: number;
    offset?: number;
  }) {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const accountId = (params.accountId ?? '').trim();
    if (!accountId) throw new BadRequestException('accountId is required');
    const at = this.parseAt(params.at);
    const from = params.from ? new Date(params.from) : null;
    if (from && Number.isNaN(from.getTime()))
      throw new BadRequestException('from is invalid');

    const take = Math.min(params.limit ?? 50, 200);
    const skip = params.offset ?? 0;

    const where: Prisma.AccountingEntryWhereInput = {
      legalEntityId,
      postingDate: { lte: at, ...(from ? { gte: from } : {}) } as any,
      OR: [{ debitAccount: accountId }, { creditAccount: accountId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingEntry.findMany({
        where,
        orderBy: [{ postingDate: 'desc' }, { lineNumber: 'desc' }],
        take,
        skip,
        select: {
          id: true,
          docType: true,
          docId: true,
          postingDate: true,
          debitAccount: true,
          creditAccount: true,
          amountBase: true,
          currency: true,
          metadata: true,
        },
      }),
      this.prisma.accountingEntry.count({ where }),
    ]);

    return {
      legalEntityId,
      accountId,
      at: at.toISOString(),
      from: from ? from.toISOString() : null,
      total,
      items: items.map((e: any) => ({
        id: e.id,
        docType: e.docType,
        docId: e.docId,
        postingDate: e.postingDate,
        debitAccount: e.debitAccount,
        creditAccount: e.creditAccount,
        amountBase: e.amountBase?.toNumber?.() ?? Number(e.amountBase ?? 0),
        currency: e.currency,
        docLineId: e.metadata?.docLineId ?? null,
      })),
    };
  }
}

