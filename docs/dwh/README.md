# DWH/BI contour (RAW → CORE → MARTS)

## Scope (stage 0)
- RAW export: `stock_movements`, `inventory_balances`, `inventory_batches` (optional), `accounting_entries`, `inventory_adjustments`, `scm_transfers`, `scm_supplies`, `sales_documents`, `sales_document_lines`, `os_events` (optional).
- CORE views: `core_stock_movements`, `core_accounting_entries`, `core_inventory_snapshot_daily`.
- MARTS views: `mart_pnl_daily`, `mart_inventory_balance_daily`.
- DocTypes covered: `SUPPLY`, `SALES_DOCUMENT`, `INVENTORY_ADJUSTMENT`, `STOCK_TRANSFER` (+ sourceDocType/sourceDocId).

## Datasets
- Env-configurable:
  - `BQ_PROJECT_ID`
  - `BQ_DATASET_RAW`
  - `BQ_DATASET_CORE`
  - `BQ_DATASET_MARTS`

## Pipeline (baseline)
1) RAW export (cron/n8n) — full or incremental by `updated_at`.
2) CORE: run SQL in `docs/dwh/core.sql`.
3) MARTS: run SQL in `docs/dwh/marts.sql`.

Suggested schedule: nightly (e.g., 02:00 local). For small volumes, full refresh is acceptable; otherwise switch to incremental MERGE.

## How to use
- Deploy RAW export endpoints `/os/v1/dwh/export/raw`.
- Create datasets in BigQuery per env.
- Execute `core.sql`, then `marts.sql` in the target project/datasets.

## Files
- `core.sql` — creates/overwrites core tables.
- `marts.sql` — creates/overwrites marts (P&L daily, inventory balance daily).
- `core-tables.md` — definitions and field meanings.

















