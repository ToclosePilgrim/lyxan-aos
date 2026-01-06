# FinanceReport usage (staging/RAW)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

## 1. Роль
- FinanceReport — staging-таблица после импорта отчётов маркетплейсов (OZON/WB и т.п.).
- Не является документом продаж, не используется для официального P&L/COGS/склада.
- Официальный контур: SalesDocument(+Line) → FIFO (stockBatch/stockMovement) → AccountingEntry.

## 2. Использование в коде

### `backend/src/modules/finance/finance.service.ts`
- CRUD по FinanceReport (staging). P&L переведён на AccountingEntry.

### `backend/src/modules/finance/sales-documents/sales-documents.service.ts`
- Берёт FinanceReport как источник для импорта в SalesDocument (importFromReports).

### `backend/src/modules/analytics/analytics.service.ts`
- Использует FinanceReport для сырых дашбордов (RAW), помечено как staging/legacy.

### Тесты
- `backend/test/finance-sales-documents.e2e-spec.ts` — проверка связи FinanceReport → SalesDocument.

## 3. Допустимо
- Импорт и хранение сырых данных.
- Временная/внутренняя аналитика RAW (с явной пометкой, не для управленческого учёта).

## 4. Недопустимо
- Использовать FinanceReport напрямую для:
  - P&L / маржи,
  - расчёта себестоимости,
  - складских движений,
  - управленческой отчётности.

## 5. Канонический путь
- Импорт отчёта → FinanceReport (staging) → SalesDocumentsService.importFromReports → SalesDocument → postSalesDocument → AccountingEntry → P&L по ledger.




















