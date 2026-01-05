export function normalizeMarketplaceProvider(
  provider?: string | null,
): string | null {
  const v = (provider ?? '').trim();
  return v ? v.toUpperCase() : null;
}

export function normalizeMarketplaceFeeCode(
  feeCode?: string | null,
): string | null {
  const v = (feeCode ?? '').trim();
  return v ? v.toUpperCase() : null;
}

/**
 * feeKey standard (single for entire system):
 * feeKey = provider + ":" + feeCode + ":" + (orderId || operationId || docLineId)
 *
 * - if orderId exists -> priority
 * - else operationId
 * - else fallback docLineId
 */
export function buildMarketplaceFeeKey(params: {
  provider?: string | null;
  feeCode?: string | null;
  orderId?: string | null;
  operationId?: string | null;
  docLineId: string;
}): string {
  const provider = normalizeMarketplaceProvider(params.provider) ?? 'UNKNOWN';
  const feeCode = normalizeMarketplaceFeeCode(params.feeCode) ?? 'UNKNOWN';
  const ref =
    (params.orderId ?? '').trim() ||
    (params.operationId ?? '').trim() ||
    (params.docLineId ?? '').trim();
  return `${provider}:${feeCode}:${ref}`;
}

