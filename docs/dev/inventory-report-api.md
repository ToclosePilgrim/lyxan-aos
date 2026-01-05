# Inventory Report API (canonical)

## Эндпоинты
- `GET /inventory/report/balances`
  - query: warehouseId?, itemId?, productId?, supplierItemId?, page?, pageSize?
  - Возвращает агрегированные остатки (qty, avgCost, totalCost) по склад+item.
- `GET /inventory/report/batches`
  - query: warehouseId (обяз.), itemId (обяз.), includeZeroQty?, page?, pageSize?
  - Возвращает партии stockBatch с costPerUnit, quantity, sourceDoc.
- `GET /inventory/report/movements`
  - query: warehouseId (обяз.), itemId (обяз.), dateFrom?, dateTo?, movementType?, docType?, page?, pageSize?
  - Возвращает историю stockMovement с batchAllocations и links на AccountingEntry (через InventoryAccountingLink).

## DTO (ключевые поля)
- Balances: `warehouseId`, `itemId`, `quantity`, `avgCost`, `totalCost`, `currency`.
- Batches: `batchId`, `warehouseId`, `itemId`, `quantity`, `costPerUnit`, `totalCost`, `sourceType`, `sourceDocId`, `receivedAt`.
- Movements: `movementId`, `warehouseId`, `itemId`, `occurredAt`, `movementType`, `quantity`, `docType/docId`, `batches[]`, `accountingEntries[]`.

## Назначение
- Balances — оперативная картина запасов.
- Batches — контроль партий и себестоимости.
- Movements — расследование движений, связь со складом и бухгалтерией.

















