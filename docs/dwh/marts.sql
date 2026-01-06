-- MART: daily P&L (company-level)
-- Requires a helper mapping of accounts to groups; replace CASE with your chart-of-accounts mapping.

WITH entries AS (
  SELECT
    DATE(e.created_at) AS txn_date,
    e.debit_account,
    e.credit_account,
    e.amount
  FROM `${BQ_PROJECT_ID}.${BQ_DATASET_CORE}.core_accounting_entries` e
),
mapped AS (
  SELECT
    txn_date,
    debit_account AS account,
    -amount AS amount,
    CASE
      WHEN debit_account IN ('90.01', '90.01.1') THEN 'REVENUE'
      WHEN debit_account = '90.02' THEN 'COGS'
      WHEN debit_account = '90.02.1' THEN 'MARKETPLACE_FEES'
      WHEN debit_account = '90.02.2' THEN 'LOGISTICS'
      WHEN debit_account = '90.02.3' THEN 'REFUNDS'
      WHEN debit_account = '94.01' THEN 'ADJUSTMENT_LOSS'
      WHEN debit_account = '26.01' THEN 'OPEX'
      WHEN debit_account = '26.02' THEN 'OPEX'
      WHEN debit_account = '26.03' THEN 'OPEX'
      ELSE 'OTHER'
    END AS account_group
  FROM entries
  UNION ALL
  SELECT
    txn_date,
    credit_account AS account,
    amount AS amount,
    CASE
      WHEN credit_account IN ('90.01', '90.01.1') THEN 'REVENUE'
      WHEN credit_account = '90.02' THEN 'COGS'
      WHEN credit_account = '90.02.1' THEN 'MARKETPLACE_FEES'
      WHEN credit_account = '90.02.2' THEN 'LOGISTICS'
      WHEN credit_account = '90.02.3' THEN 'REFUNDS'
      WHEN credit_account = '91.01' THEN 'ADJUSTMENT_GAIN'
      WHEN credit_account IN ('26.01','26.02','26.03') THEN 'OPEX'
      ELSE 'OTHER'
    END AS account_group
  FROM entries
)
CREATE OR REPLACE TABLE `${BQ_PROJECT_ID}.${BQ_DATASET_MARTS}.mart_pnl_daily` AS
SELECT
  txn_date,
  SUM(CASE WHEN account_group = 'REVENUE' THEN amount ELSE 0 END) AS revenue,
  SUM(CASE WHEN account_group = 'COGS' THEN amount ELSE 0 END) AS cogs,
  SUM(CASE WHEN account_group = 'MARKETPLACE_FEES' THEN amount ELSE 0 END) AS marketplace_fees,
  SUM(CASE WHEN account_group = 'REFUNDS' THEN amount ELSE 0 END) AS refunds,
  SUM(CASE WHEN account_group = 'LOGISTICS' THEN amount ELSE 0 END) AS logistics,
  SUM(CASE WHEN account_group = 'OPEX' THEN amount ELSE 0 END) AS opex,
  SUM(CASE WHEN account_group = 'ADJUSTMENT_LOSS' THEN amount ELSE 0 END) AS adjustment_loss,
  SUM(CASE WHEN account_group = 'ADJUSTMENT_GAIN' THEN amount ELSE 0 END) AS adjustment_gain,
  SUM(CASE WHEN account_group IN ('REVENUE','COGS','MARKETPLACE_FEES','REFUNDS','LOGISTICS','OPEX','ADJUSTMENT_LOSS','ADJUSTMENT_GAIN') THEN amount ELSE 0 END) AS gross_margin
FROM mapped
GROUP BY txn_date
ORDER BY txn_date;

-- MART: daily inventory balance
CREATE OR REPLACE TABLE `${BQ_PROJECT_ID}.${BQ_DATASET_MARTS}.mart_inventory_balance_daily` AS
SELECT
  snapshot_date,
  warehouse_id,
  item_id,
  quantity,
  avg_cost,
  total_cost
FROM `${BQ_PROJECT_ID}.${BQ_DATASET_CORE}.core_inventory_snapshot_daily`;




















