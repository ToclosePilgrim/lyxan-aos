import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetPnlDto } from './dto/get-pnl.dto';
import { PNL_ACCOUNT_GROUPS } from './pnl-account-groups';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  // ============ P&L ============

  async getPnl(dto: GetPnlDto) {
    const where: Prisma.AccountingEntryWhereInput = {};
    // TZ 1.1: allow legalEntityId as primary filter (fallback to brand+country -> legalEntityId lookup)
    if (dto.legalEntityId) {
      where.legalEntityId = dto.legalEntityId;
    } else {
      // Backward compatible input, but query is by legalEntityId
      if (!dto?.countryId || !dto?.brandId) {
        throw new BadRequestException(
          'legalEntityId or (countryId and brandId) are required',
        );
      }
      const bc = await (this.prisma as any).brandCountry.findUnique({
        where: {
          brandId_countryId: { brandId: dto.brandId, countryId: dto.countryId },
        },
        select: { legalEntityId: true },
      });
      const legalEntityId = bc?.legalEntityId ?? null;
      if (!legalEntityId) {
        throw new BadRequestException(
          'No LegalEntity configured for brand+country; configure BrandCountry.legalEntityId',
        );
      }
      where.legalEntityId = legalEntityId;
    }
    if (dto.marketplaceId) {
      where.marketplaceId = dto.marketplaceId;
    }
    if (dto?.dateFrom || dto?.dateTo) {
      where.postingDate = {};
      if (dto.dateFrom) {
        where.postingDate.gte = new Date(dto.dateFrom);
      }
      if (dto.dateTo) {
        const dt = new Date(dto.dateTo);
        dt.setHours(23, 59, 59, 999);
        where.postingDate.lte = dt;
      }
    }

    const entries = await this.prisma.accountingEntry.findMany({ where });

    const useBase = (entry: any) =>
      entry.amountBase?.toNumber?.() ?? Number(entry.amount ?? 0);

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalMarketplaceFees = 0;
    let totalRefunds = 0;
    let totalLogistics = 0;
    let totalOpex = 0;

    const addIncome = (accounts: readonly string[], e: any, val: number) => {
      if (accounts.includes(e.creditAccount)) return val;
      if (accounts.includes(e.debitAccount)) return -val;
      return 0;
    };
    const addExpense = (accounts: readonly string[], e: any, val: number) => {
      if (accounts.includes(e.debitAccount)) return val;
      if (accounts.includes(e.creditAccount)) return -val;
      return 0;
    };

    for (const e of entries) {
      const val = useBase(e);
      // Universal P&L sign rules (MVP via account grouping):
      // - Income accounts: credit - debit
      // - Expense accounts: debit - credit
      totalRevenue += addIncome(PNL_ACCOUNT_GROUPS.REVENUE, e, val);
      // NOTE: COGS/refunds/fees/etc are treated as expenses (reversals via credit reduce them)
      totalCogs += addExpense(PNL_ACCOUNT_GROUPS.COGS, e, val);
      totalMarketplaceFees += addExpense(PNL_ACCOUNT_GROUPS.MARKETPLACE_FEES, e, val);
      totalRefunds += addExpense(PNL_ACCOUNT_GROUPS.REFUNDS, e, val);
      totalLogistics += addExpense(PNL_ACCOUNT_GROUPS.LOGISTICS, e, val);
      totalOpex += addExpense(PNL_ACCOUNT_GROUPS.OPEX, e, val);
    }

    const grossMargin =
      totalRevenue - totalCogs - totalMarketplaceFees - totalRefunds;
    const grossMarginPercent =
      totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCogs,
      totalMarketplaceFees,
      totalRefunds,
      totalLogistics,
      totalOpex,
      grossMargin,
      grossMarginPercent,
      dateFrom: dto.dateFrom ?? null,
      dateTo: dto.dateTo ?? null,
    };
  }
}
