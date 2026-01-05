# BigQuery Data Layer (RAW → CORE → MARTS)

## Архитектура
- Datasets: `aos_raw`, `aos_core`, `aos_marts`.
- Источник данных — Postgres (Prisma модели). Обновление инкрементально по `updatedAt` (CDC-подход) или полным дампом при малых объёмах.
- Оркестрация: n8n/Airbyte или иной ETL. На стороне бекенда есть вспомогательный экспорт `/os/v1/export/raw?table=...&updatedSince=...` и триггер `/os/v1/dwh/refresh` (заглушка).

## RAW (1:1 Postgres)
Реплицируются таблицы (основной набор):
- `scm_supply`, `scm_supply_item`, `scm_product`, `warehouse`
- `stock_batch`, `stock_movement`, `inventory_transaction`, `inventory_balance`
- `sales_document`, `sales_document_line`
- `financial_document`, `accounting_entry`
- `os_event`

Правила:
- Типы как в источнике; даты → TIMESTAMP в BQ.
- Инкрементальные выборки: `WHERE updated_at > :last_ts` если поле есть.

## CORE (нормализовано)
Таблицы-примеры:
- `core_supplies`, `core_supply_items`
- `core_sales_documents`, `core_sales_lines`
- `core_stock_batches`, `core_stock_movements`
- `core_inventory_transactions`, `core_inventory_balances`
- `core_financial_documents`, `core_accounting_entries`

Правила:
- ID → STRING, деньги → NUMERIC, даты → TIMESTAMP.
- Взаимосвязи по бизнес-ключам (supply_id, sales_document_id, item_id, warehouse_id, doc_id, doc_type).
- Формируется SQL-вида (view/merge):
```
INSERT/REPLACE INTO aos_core.core_sales_documents
SELECT id AS sales_document_id, marketplace_id, brand_id, warehouse_id,
       status, totalRevenue AS revenue_total, totalCogs AS cogs_total,
       totalCommission AS commission_total, totalRefunds AS refund_total,
       periodFrom AS period_from, periodTo AS period_to, updatedAt AS posted_at
FROM aos_raw.sales_document
WHERE updatedAt > @last_ts;
```

## MARTS (витрины)
Минимальный набор:
- `marts_daily_pnl` (date, brand_id, marketplace_id, revenue, cogs, commission, refunds, gross_margin, gross_margin_pct)
- `marts_inventory_eod` (date, warehouse_id, item_id, quantity, avg_cost, total_cost)
- `marts_sales_lines_enriched` (line-level with revenue, cogs, profit, commission, refunds, sku/product/brand/warehouse/marketplace)
- `marts_fifo_audit` (movement_id, batch_id, item_id, warehouse_id, qty_delta, cost_per_unit, movement_type, occurred_at, doc_type, doc_id)
- `marts_supply_turnover` (supply_id, item_id, initial_qty, received_at, first_sale_at, days_to_first_sale, days_to_exhaustion)

## Обновление
- Шаги каждые 15–60 мин:
  1) RAW sync (updatedSince)
  2) CORE refresh (views/materialized merges)
  3) MARTS refresh (aggregations)
- Оркестрация через n8n/Airbyte + BQ connector (Service Account).

## API-хуки (для агентов/оркестрации)
- `/os/v1/export/raw?table=...&updatedSince=...&limit=...` — отдать инкрементальные данные whitelisted таблиц.
- `/os/v1/dwh/refresh` — триггер (заглушка) для запуска пайплайна.
- `/os/v1/dwh/query` — отключено в prod-среде; используйте прямой доступ к BigQuery.

## Безопасность / соглашения
- Только whitelisted таблицы для raw-export.
- Параметризация SQL в ETL нодах, никаких dynamic SQL из внешнего API.
- Разделение зон RAW/CORE/MARTS, стабильные схемы и именование.

















