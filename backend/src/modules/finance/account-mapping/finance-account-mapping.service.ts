import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface SalesPostingAccounts {
  arAccount: string;
  revenueAccount: string;
  contraRevenueAccount: string;
  cogsAccount: string;
  inventoryAssetAccount: string;
  marketplaceFeeExpenseAccount: string;
}

export interface SalesReturnPostingAccounts extends SalesPostingAccounts {
  /**
   * Clearing account used to split the COGS reversal into two AccountingEntry rows:
   * - DR Inventory / CR Clearing
   * - DR Clearing / CR COGS
   *
   * This enables deterministic InventoryAccountingLink invariants:
   * - linkType=INVENTORY → inventoryEntryId
   * - linkType=COGS → cogsEntryId
   */
  inventoryCogsClearingAccount: string;
}

@Injectable()
export class FinanceAccountMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesPostingAccounts(params: {
    legalEntityId: string;
    marketplaceId?: string | null;
  }): Promise<SalesPostingAccounts> {
    const row = await (this.prisma as any).financeAccountMapping.findFirst({
      where: {
        legalEntityId: params.legalEntityId,
        docType: 'SALES_DOCUMENT',
        marketplaceId: params.marketplaceId ?? null,
      } as any,
      orderBy: [{ updatedAt: 'desc' }],
    });

    // Fallback: legalEntityId + docType without marketplace
    const fallback =
      row ??
      (await (this.prisma as any).financeAccountMapping.findFirst({
        where: {
          legalEntityId: params.legalEntityId,
          docType: 'SALES_DOCUMENT',
          marketplaceId: null,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
      }));

    const mapping = (fallback?.mapping ?? null) as any;
    if (!mapping) {
      throw new UnprocessableEntityException({
        message:
          'Missing finance account mapping for Sales posting (SALES_DOCUMENT)',
        code: 'FINANCE_ACCOUNT_MAPPING_MISSING',
        details: {
          legalEntityId: params.legalEntityId,
          docType: 'SALES_DOCUMENT',
          marketplaceId: params.marketplaceId ?? null,
        },
      });
    }

    const required = [
      'arAccount',
      'revenueAccount',
      'cogsAccount',
      'inventoryAssetAccount',
      'marketplaceFeeExpenseAccount',
    ] as const;
    for (const k of required) {
      if (!mapping[k] || typeof mapping[k] !== 'string') {
        throw new UnprocessableEntityException({
          message: `Invalid finance account mapping for sales: missing ${k}`,
          code: 'FINANCE_ACCOUNT_MAPPING_INVALID',
          details: { legalEntityId: params.legalEntityId, key: k },
        });
      }
    }

    const contraRevenue =
      typeof mapping.contraRevenueAccount === 'string' &&
      mapping.contraRevenueAccount.trim().length
        ? mapping.contraRevenueAccount
        : mapping.revenueAccount;

    return {
      arAccount: mapping.arAccount,
      revenueAccount: mapping.revenueAccount,
      contraRevenueAccount: contraRevenue,
      cogsAccount: mapping.cogsAccount,
      inventoryAssetAccount: mapping.inventoryAssetAccount,
      marketplaceFeeExpenseAccount: mapping.marketplaceFeeExpenseAccount,
    };
  }

  async getSalesReturnPostingAccounts(params: {
    legalEntityId: string;
    marketplaceId?: string | null;
  }): Promise<SalesReturnPostingAccounts> {
    // Prefer SALE_RETURN-specific mapping if present, otherwise fallback to SALES_DOCUMENT mapping.
    const row =
      (await (this.prisma as any).financeAccountMapping.findFirst({
        where: {
          legalEntityId: params.legalEntityId,
          docType: 'SALE_RETURN',
          marketplaceId: params.marketplaceId ?? null,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
      })) ??
      (await (this.prisma as any).financeAccountMapping.findFirst({
        where: {
          legalEntityId: params.legalEntityId,
          docType: 'SALE_RETURN',
          marketplaceId: null,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
      }));

    const fallback =
      row ??
      (await (this.prisma as any).financeAccountMapping.findFirst({
        where: {
          legalEntityId: params.legalEntityId,
          docType: 'SALES_DOCUMENT',
          marketplaceId: params.marketplaceId ?? null,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
      })) ??
      (await (this.prisma as any).financeAccountMapping.findFirst({
        where: {
          legalEntityId: params.legalEntityId,
          docType: 'SALES_DOCUMENT',
          marketplaceId: null,
        } as any,
        orderBy: [{ updatedAt: 'desc' }],
      }));

    const mapping = (fallback?.mapping ?? null) as any;
    if (!mapping) {
      throw new UnprocessableEntityException({
        message: 'Missing finance account mapping for Sales return posting (SALE_RETURN)',
        code: 'FINANCE_ACCOUNT_MAPPING_MISSING',
        details: {
          legalEntityId: params.legalEntityId,
          docType: 'SALE_RETURN',
          marketplaceId: params.marketplaceId ?? null,
        },
      });
    }

    const base = await this.getSalesPostingAccounts(params);
    const clearing =
      typeof mapping.inventoryCogsClearingAccount === 'string' &&
      mapping.inventoryCogsClearingAccount.trim().length
        ? mapping.inventoryCogsClearingAccount
        : null;
    if (!clearing) {
      throw new UnprocessableEntityException({
        message:
          'Invalid finance account mapping for sales return: missing inventoryCogsClearingAccount',
        code: 'FINANCE_ACCOUNT_MAPPING_INVALID',
        details: {
          legalEntityId: params.legalEntityId,
          key: 'inventoryCogsClearingAccount',
        },
      });
    }

    return {
      ...base,
      inventoryCogsClearingAccount: clearing,
    };
  }
}


