# OS API v1 (Agent / Integration Layer)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

## Принципы
- Префикс: `/os/v1/...`
- Ответы в формате `OsApiResponse<T>`: `{ success: true, data }` либо `{ success: false, error: { code, message, details? } }`.
- DTO стабильные, без @prisma/client типов наружу.
- Аутентификация — та же JWT, что у основного API.
 - OS API — **integration/tool layer**, не источник правды. Runtime SoT: SCM/Inventory/Finance canon.

## SCM
- `GET /os/v1/scm/supplies` — список поставок (фильтры: status, supplierId, warehouseId, page/pageSize).
- `POST /os/v1/scm/supplies/:id/confirm-receive` — приёмка (обёртка над confirmReceive).
- `GET /os/v1/scm/sales-documents` — список документов продаж (status, marketplaceId, brandId, dateFrom/dateTo, пагинация).
- `GET /os/v1/scm/sales-documents/:id` — документ + строки.
- `POST /os/v1/scm/sales-documents/:id/post` — проведение (FIFO + проводки).

## Inventory
- `GET /os/v1/inventory/balances` — **alias** над `InventoryReportService.getBalances`.
- `GET /os/v1/inventory/batches` — **deprecated alias** над `InventoryReportService.getBatches` (интеграциям).
- `GET /os/v1/inventory/movements` — **alias** над `InventoryReportService.getMovements`.

⚠️ Эти эндпоинты существуют для интеграций/агентов. Каноничные отчёты: `/inventory/report/*`.

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




















