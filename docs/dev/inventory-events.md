# Inventory events (ADJUSTMENT_POSTED, TRANSFER_POSTED, STOCK_CHANGED)

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
- payload (единый):
  - `warehouseId`, `itemId`
  - `qtyDelta` (со знаком)
  - `movementType`
  - `movementId`
  - `sourceDocType`, `sourceDocId`

## Инварианты
- `sourceDocType/sourceDocId` совпадают с docType/docId исходного бизнес-документа.
- transfer: два STOCK_CHANGED (OUT/IN) + один TRANSFER_POSTED.
- adjustment: один STOCK_CHANGED + один ADJUSTMENT_POSTED.
















