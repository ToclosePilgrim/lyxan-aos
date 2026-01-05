-- TZ 8.3.B.3 — Add FinanceLinkedDocType.SUPPLY_RECEIPT for FinancialDocument linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'FinanceLinkedDocType'
      AND e.enumlabel = 'SUPPLY_RECEIPT'
  ) THEN
    ALTER TYPE "FinanceLinkedDocType" ADD VALUE 'SUPPLY_RECEIPT';
  END IF;
END $$;



