/**
 * Utility functions for generating idempotency keys for inventory operations.
 * Format: invtx:v1:<sourceDocType>:<sourceDocId>:<operationType>:<lineId?>
 * Format: invm:v1:<sourceDocType>:<sourceDocId>:<direction>:<itemId>:<warehouseId>:<batchId?>:<lineId?>
 */

export function buildInventoryTransactionIdempotencyKey(params: {
  sourceDocType: string;
  sourceDocId: string;
  operationType: 'IN' | 'OUT' | 'ADJUST';
  lineId?: string | null;
}): string {
  const parts = [
    'invtx',
    'v1',
    params.sourceDocType,
    params.sourceDocId,
    params.operationType,
  ];
  if (params.lineId) {
    parts.push(params.lineId);
  }
  return parts.join(':');
}

export function buildStockMovementIdempotencyKey(params: {
  sourceDocType: string;
  sourceDocId: string;
  direction: 'IN' | 'OUT';
  itemId: string;
  warehouseId: string;
  batchId?: string | null;
  lineId?: string | null;
  partN?: number | null; // For FIFO multi-batch outcomes
}): string {
  const parts = [
    'invm',
    'v1',
    params.sourceDocType,
    params.sourceDocId,
    params.direction,
    params.itemId,
    params.warehouseId,
  ];
  if (params.batchId) {
    parts.push(params.batchId);
  }
  if (params.partN !== null && params.partN !== undefined) {
    parts.push(`part${params.partN}`);
  }
  if (params.lineId) {
    parts.push(params.lineId);
  }
  return parts.join(':');
}



