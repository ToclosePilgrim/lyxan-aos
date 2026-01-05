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

    for (const e of entries) {
      const val = useBase(e);
      if (PNL_ACCOUNT_GROUPS.REVENUE.includes(e.creditAccount)) {
        totalRevenue += val;
      }
      if (PNL_ACCOUNT_GROUPS.COGS.includes(e.debitAccount)) {
        totalCogs += val;
      }
      if (PNL_ACCOUNT_GROUPS.MARKETPLACE_FEES.includes(e.debitAccount)) {
        totalMarketplaceFees += val;
      }
      if (PNL_ACCOUNT_GROUPS.REFUNDS.includes(e.debitAccount)) {
        totalRefunds += val;
      }
      if (PNL_ACCOUNT_GROUPS.LOGISTICS.includes(e.debitAccount)) {
        totalLogistics += val;
      }
      if (PNL_ACCOUNT_GROUPS.OPEX.includes(e.debitAccount)) {
        totalOpex += val;
      }
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
