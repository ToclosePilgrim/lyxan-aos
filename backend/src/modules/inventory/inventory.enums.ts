export const InventoryMovementType = {
  INCOME: 'INCOME',
  OUTCOME: 'OUTCOME',
  SCRAP: 'SCRAP',
  LOSS: 'LOSS',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type InventoryMovementType =
  (typeof InventoryMovementType)[keyof typeof InventoryMovementType];

export const InventoryDocumentType = {
  SUPPLY: 'SUPPLY',
  TRANSFER: 'TRANSFER',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  PRODUCTION_INPUT: 'PRODUCTION_INPUT',
  PRODUCTION_OUTPUT: 'PRODUCTION_OUTPUT',
  SALE: 'SALE',
  SALE_RETURN: 'SALE_RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  SCRAP: 'SCRAP',
  LOSS: 'LOSS',
} as const;

export type InventoryDocumentType =
  (typeof InventoryDocumentType)[keyof typeof InventoryDocumentType];

export const InventoryBatchSourceType = {
  SUPPLY: 'SUPPLY',
  PRODUCTION: 'PRODUCTION',
  TRANSFER: 'TRANSFER',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
} as const;

export type InventoryBatchSourceType =
  (typeof InventoryBatchSourceType)[keyof typeof InventoryBatchSourceType];

export const InventoryAccountingLinkRole = {
  REVENUE: 'REVENUE',
  REFUND: 'REFUND',
  COGS: 'COGS',
  MARKETPLACE_FEE: 'MARKETPLACE_FEE',
  SUPPLY_RECEIPT: 'SUPPLY_RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  PRODUCTION_INPUT: 'PRODUCTION_INPUT',
  PRODUCTION_OUTPUT: 'PRODUCTION_OUTPUT',
} as const;

export type InventoryAccountingLinkRole =
  (typeof InventoryAccountingLinkRole)[keyof typeof InventoryAccountingLinkRole];

export function isInventoryMovementType(
  value: any,
): value is InventoryMovementType {
  return Object.values(InventoryMovementType).includes(value);
}

export function isInventoryDocumentType(
  value: any,
): value is InventoryDocumentType {
  return Object.values(InventoryDocumentType).includes(value);
}
