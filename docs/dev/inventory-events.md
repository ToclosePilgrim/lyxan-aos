# Inventory events (ADJUSTMENT_POSTED, TRANSFER_POSTED, STOCK_CHANGED)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

Цель: единый контракт для событий инвентаря с обязательными `sourceDocType` / `sourceDocId`.

## Общие правила
- Любое INVENTORY.* событие содержит `sourceDocType` и `sourceDocId`, указывающие на первичный документ.
- STOCK_CHANGED: универсальное событие для любого движения склада.
  - payload: `warehouseId`, `itemId`, `qtyDelta`, `movementType`, `movementId`, `sourceDocType`, `sourceDocId`.

## INVENTORY.ADJUSTMENT_POSTED
- Генерируется при успешном проведении InventoryAdjustment (IN/OUT).
- payload:
  - `adjustmentId`
  - `warehouseId`
  - `itemId`
  - `quantityDelta` (+/-)
  - `direction`: IN|OUT
  - `unitCost`, `totalCost`
  - `movementId`
  - `entryId` (если есть проводка)
  - `sourceDocType`: INVENTORY_ADJUSTMENT
  - `sourceDocId`

## INVENTORY.TRANSFER_POSTED
- Генерируется при postTransfer (Stage 0 без проводок).
- payload:
  - `transferId`
  - `fromWarehouseId`, `toWarehouseId`
  - `itemId`, `quantity`
  - `outMovementId`, `inMovementId`
  - `sourceDocType`: STOCK_TRANSFER
  - `sourceDocId`

## INVENTORY.STOCK_CHANGED
- Генерируется для любого movement (supply, sale, adjustment, transfer, …).
- **Вариант A (реализован):** Для multi-movement FIFO OUT операций эмитится отдельное событие на каждый StockMovement.
  - Все события одной операции имеют одинаковый `inventoryTransactionId` как correlationId.
- payload (v1, обязательные поля):
  - `eventType`: "STOCK_CHANGED"
  - `eventVersion`: 1
  - `occurredAt`: ISO string timestamp
  - `warehouseId`, `itemId`
  - `qtyDelta` (со знаком: IN положительный, OUT отрицательный)
  - `movementType`: enum (INCOME/OUTCOME)
  - `movementId`: ID StockMovement
  - `batchId`: ID StockBatch (nullable для случаев без batch)
  - `docType`, `docId`: тип и ID документа операции (InventoryDocumentType)
  - `sourceDocType`, `sourceDocId`: тип и ID исходного бизнес-документа (AccountingDocType)
  - `inventoryTransactionId`: ID InventoryTransaction (correlationId для группировки событий одной операции)

## Инварианты
- `sourceDocType/sourceDocId` совпадают с docType/docId исходного бизнес-документа.
- transfer: два STOCK_CHANGED (OUT/IN) + один TRANSFER_POSTED.
- adjustment: один STOCK_CHANGED + один ADJUSTMENT_POSTED.
- **Multi-movement FIFO OUT:** N StockMovement → N STOCK_CHANGED событий, все с одинаковым `inventoryTransactionId`.
- `qtyDelta` всегда со знаком: положительный для IN, отрицательный для OUT.


















