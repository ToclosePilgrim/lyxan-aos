# SCM Stocks API (canonical)

## Назначение
- Единый публичный API для UI/агентов по остаткам: работает на новом контуре ScmStock + stockMovement + stockBatch (FIFO).
- Не использовать legacy `Stock` / `sku.stocks` / эндпоинты из `scm.controller.ts`.
- Низкоуровневый ledger `/inventory/...` — для технических сценариев (глубокие проводки, аудит).

## Эндпоинты

- `GET /scm/stocks` — список остатков (ScmStock) с фильтрами `warehouseId`, `supplierItemId`, `scmProductId|productId`, `search`.  
  Ответ: массив `{ id, warehouse{ id,name,code,type }, scmProduct{ id,internalName,sku }?, supplierItem{ id,name,code,type,category,unit,supplier{...} }?, quantity:number, unit, createdAt, updatedAt }`.

- `GET /scm/stocks/summary` — агрегация по товару/позиции (без разреза по складу).  
  Ответ: массив `{ supplierItemId?, scmProductId?, totalQuantity:number, supplierItem?, scmProduct? }`.

- `GET /scm/stocks/batches` — остатки по партиям (production batches, FIFO). Фильтры: `warehouseId`, `itemId`, `productId`, `batchCode`, `expirationBefore`, `expirationAfter`, `page`, `pageSize`.  
  Ответ: `{ items: BatchStockRow[], total }`, где `BatchStockRow` содержит warehouse*, item*, unit, productionBatchId, batchCode, expirationDate, quantity, productionOrderId/code, productId/name/sku.

- `GET /scm/stocks/ledger` — движения (stockMovement) с пагинацией. Query: `warehouseId`, `itemId`, `movementType`, `from`, `to`, `page`, `limit`, `sort`.  
  Ответ: `{ total, rows: StockMovement[] }` (движения включают warehouse, batch, productionBatch ссылки; docType/docId для supply/transfer/production).

- `POST /scm/stocks/adjust` — ручная корректировка (создаёт movement типа ADJUSTMENT через FIFO движки). Body: `AdjustStockDto` (itemId, warehouseId, quantity, reason, comment, etc.). Требует Admin/Manager.

- `POST /scm/stocks/recalculate` — пересчёт стока/партий из движений (dry-run по умолчанию). Body: `RecalcStockDto` (warehouseId?, itemId?, apply?: boolean). Admin only.

## Граница с /inventory
- `/scm/stocks*` — бизнесовое представление остатков для UI: агрегированные ScmStock, движения stockMovement, партии stockBatch.
- `/inventory/...` — технический ledger (InventoryBalance/InventoryTransaction) для глубокой аналитики/интеграций. Использовать только при необходимости низкоуровневой детализации.

## Legacy
- Старые эндпоинты `/scm/stocks` в `scm.controller.ts` — LEGACY, не использовать; будут удалены после завершения миграции.
- В доменных сервисах и UI нельзя рассчитывать остатки как `sku.stocks.quantity`; брать данные только из API выше.

















