# OS API v1 (Agent / Integration Layer)

## Принципы
- Префикс: `/os/v1/...`
- Ответы в формате `OsApiResponse<T>`: `{ success: true, data }` либо `{ success: false, error: { code, message, details? } }`.
- DTO стабильные, без @prisma/client типов наружу.
- Аутентификация — та же JWT, что у основного API.

## SCM
- `GET /os/v1/scm/supplies` — список поставок (фильтры: status, supplierId, warehouseId, page/pageSize).
- `POST /os/v1/scm/supplies/:id/confirm-receive` — приёмка (обёртка над confirmReceive).
- `GET /os/v1/scm/sales-documents` — список документов продаж (status, marketplaceId, brandId, dateFrom/dateTo, пагинация).
- `GET /os/v1/scm/sales-documents/:id` — документ + строки.
- `POST /os/v1/scm/sales-documents/:id/post` — проведение (FIFO + проводки).

## Inventory
- `GET /os/v1/inventory/balances` — InventoryBalance (warehouseId/itemId/productId/supplierItemId, пагинация).
- `GET /os/v1/inventory/batches` — StockBatch (warehouseId/itemId, пагинация).
- `GET /os/v1/inventory/movements` — StockMovement (warehouseId/itemId/docId/docType, пагинация).

## Finance
- `GET /os/v1/finance/pnl` — P&L на основе AccountingEntry.
- `GET /os/v1/finance/documents` — FinancialDocument список (type, dateFrom/dateTo, пагинация).
- `GET /os/v1/finance/documents/:id/entries` — бухгалтерские проводки по документу.

## DTO (ключевые)
- OsSupplyDto, OsSalesDocumentDto/Line, OsFinancialDocumentDto, OsAccountingEntryDto.

## Ошибки
- Код/сообщение/детали в `error`.

## Канонический поток
- Import FinanceReport → SalesDocument → postSalesDocument → Inventory (stockMovement + InventoryTransaction) → AccountingEntry → P&L via OS API.

















