-- CORE: stock movements
CREATE OR REPLACE TABLE `${BQ_PROJECT_ID}.${BQ_DATASET_CORE}.core_stock_movements` AS
SELECT
  sm.id           AS movement_id,
  sm.occurred_at  AS occurred_at,
  sm.movement_type,
  sm.warehouse_id,
  sm.item_id,
  sm.quantity     AS qty_delta,
  sm.doc_type     AS doc_type,
  sm.doc_id       AS doc_id,
  sm.created_at   AS created_at,
  sm.doc_type     AS source_doc_type,
  sm.doc_id       AS source_doc_id
FROM `${BQ_PROJECT_ID}.${BQ_DATASET_RAW}.stock_movements` sm;

-- CORE: accounting entries
CREATE OR REPLACE TABLE `${BQ_PROJECT_ID}.${BQ_DATASET_CORE}.core_accounting_entries` AS
SELECT
  ae.id                AS entry_id,
  ae.created_at,
  ae.debit_account,
  ae.credit_account,
  ae.amount,
  ae.currency,
  ae.doc_type,
  ae.doc_id,
  ae.financial_document_id,
  ae.doc_type          AS source_doc_type,
  ae.doc_id            AS source_doc_id
FROM `${BQ_PROJECT_ID}.${BQ_DATASET_RAW}.accounting_entries` ae;

-- CORE: daily inventory snapshot (simple latest-state projection)
CREATE OR REPLACE TABLE `${BQ_PROJECT_ID}.${BQ_DATASET_CORE}.core_inventory_snapshot_daily` AS
SELECT
  DATE(bal.calculated_at) AS snapshot_date,
  bal.warehouse_id,
  bal.item_id,
  bal.quantity,
  bal.avg_cost,
  bal.quantity * bal.avg_cost AS total_cost
FROM `${BQ_PROJECT_ID}.${BQ_DATASET_RAW}.inventory_balances` bal;

















