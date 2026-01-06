# CORE tables (BigQuery)

## core_stock_movements
- `movement_id` (string)
- `occurred_at` (datetime)
- `movement_type` (string) — e.g., SUPPLY_RECEIPT, SALE, ADJUSTMENT_IN/OUT, TRANSFER_OUT/IN
- `warehouse_id` (string)
- `item_id` (string)
- `qty_delta` (numeric)
- `doc_type` (string, AccountingDocType)
- `doc_id` (string)
- `created_at` (datetime)
- `source_doc_type` (string) — normalized doc type (same as doc_type for now)
- `source_doc_id` (string)

## core_accounting_entries
- `entry_id` (string)
- `created_at` (datetime)
- `debit_account` (string)
- `credit_account` (string)
- `amount` (numeric)
- `currency` (string)
- `doc_type` (AccountingDocType)
- `doc_id` (string)
- `financial_document_id` (string, nullable)
- `source_doc_type` (string)
- `source_doc_id` (string)

## core_inventory_snapshot_daily
- `snapshot_date` (date)
- `warehouse_id` (string)
- `item_id` (string)
- `quantity` (numeric)
- `avg_cost` (numeric)
- `total_cost` (numeric)




















