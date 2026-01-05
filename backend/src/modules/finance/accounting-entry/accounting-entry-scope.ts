import { AccountingDocType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export async function resolveAccountingEntryScope(params: {
  client: Prisma.TransactionClient | PrismaService;
  docType: AccountingDocType;
  docId: string;
  sourceDocType: AccountingDocType | null;
  sourceDocId: string | null;
  legalEntityId?: string;
  countryId?: string;
  brandId?: string;
  marketplaceId?: string | null;
  warehouseId?: string | null;
}): Promise<{
  countryId: string;
  brandId: string;
  legalEntityId: string;
  marketplaceId: string | null;
  warehouseId: string | null;
}> {
  const resolveLegalEntityId = async (brandId: string, countryId: string) => {
    const bc = await (params.client as any).brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } },
      select: { legalEntityId: true },
    });
    const legalEntityId = bc?.legalEntityId ?? null;
    if (!legalEntityId) {
      throw new Error(
        `No LegalEntity configured for brand+country (${brandId}, ${countryId}); configure BrandCountry.legalEntityId`,
      );
    }
    return legalEntityId as string;
  };

  // If we have legalEntityId but no explicit brand+country, derive a canonical pair via BrandCountry.
  // This is important for treasury postings (e.g. INTERNAL_TRANSFER) where brand/country are not inherent,
  // but AccountingEntry requires non-null brandId/countryId for indexing/reporting.
  if (params.legalEntityId && (!params.countryId || !params.brandId)) {
    const bc = await (params.client as any).brandCountry.findFirst({
      where: { legalEntityId: params.legalEntityId },
      orderBy: [{ brandId: 'asc' }, { countryId: 'asc' }],
      select: { brandId: true, countryId: true, legalEntityId: true },
    });
    if (bc?.brandId && bc?.countryId) {
      return {
        countryId: bc.countryId,
        brandId: bc.brandId,
        legalEntityId: params.legalEntityId,
        marketplaceId: params.marketplaceId ?? null,
        warehouseId: params.warehouseId ?? null,
      };
    }
    // fall through to existing logic/error
  }

  // If scope is explicitly provided – it's the source of truth (C.3).
  if (params.countryId && params.brandId) {
    return {
      countryId: params.countryId,
      brandId: params.brandId,
      legalEntityId:
        params.legalEntityId ??
        (await resolveLegalEntityId(params.brandId, params.countryId)),
      marketplaceId: params.marketplaceId ?? null,
      warehouseId: params.warehouseId ?? null,
    };
  }

  // Minimal resolver for production docs (needed by Finance posting).
  if (
    params.docType === AccountingDocType.PRODUCTION_COMPLETION ||
    params.docType === AccountingDocType.PRODUCTION_CONSUMPTION
  ) {
    const orderId =
      params.docType === AccountingDocType.PRODUCTION_COMPLETION
        ? params.docId
        : params.sourceDocId;
    if (!orderId) {
      throw new Error(
        `Cannot resolve scope for ${params.docType}: sourceDocId (productionOrderId) is required`,
      );
    }

    const po = await (params.client as any).productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ScmProduct: { select: { brandId: true } },
        warehouses_production_orders_warehouseIdTowarehouses: {
          select: { countryId: true },
        },
      },
    });

    const brandId = po?.ScmProduct?.brandId ?? null;
    const countryId =
      po?.warehouses_production_orders_warehouseIdTowarehouses?.countryId ??
      null;
    const warehouseId = po?.warehouseId ?? null;

    if (!brandId || !countryId) {
      throw new Error(
        `Cannot resolve scope for ${params.docType} (${params.docId}): brandId/countryId not found`,
      );
    }

    return {
      brandId,
      countryId,
      legalEntityId:
        params.legalEntityId ??
        (await resolveLegalEntityId(brandId, countryId)),
      marketplaceId: params.marketplaceId ?? null,
      warehouseId: params.warehouseId ?? warehouseId ?? null,
    };
  }

  if (params.docType === AccountingDocType.SUPPLY_RECEIPT) {
    const receipt = await (params.client as any).scmSupplyReceipt.findUnique({
      where: { id: params.docId },
      include: {
        ScmSupply: {
          select: {
            brandId: true,
            warehouse: { select: { countryId: true } },
            warehouseId: true,
          },
        },
      },
    });

    const brandId = receipt?.ScmSupply?.brandId ?? null;
    const countryId = receipt?.ScmSupply?.warehouse?.countryId ?? null;
    const warehouseId = receipt?.ScmSupply?.warehouseId ?? null;

    if (!brandId || !countryId) {
      throw new Error(
        `Cannot resolve scope for ${params.docType} (${params.docId}): brandId/countryId not found`,
      );
    }

    return {
      brandId,
      countryId,
      legalEntityId:
        params.legalEntityId ??
        (await resolveLegalEntityId(brandId, countryId)),
      marketplaceId: params.marketplaceId ?? null,
      warehouseId: params.warehouseId ?? warehouseId ?? null,
    };
  }

  // Conservative fallback: require explicit scope for now.
  throw new Error(
    `Cannot resolve scope for ${params.docType} (${params.docId}). Provide explicit countryId+brandId (and optionally warehouseId/marketplaceId).`,
  );
}
