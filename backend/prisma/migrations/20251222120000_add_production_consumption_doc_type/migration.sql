-- Add AccountingDocType.PRODUCTION_CONSUMPTION
-- Safe to run multiple times (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType'
      AND e.enumlabel = 'PRODUCTION_CONSUMPTION'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'PRODUCTION_CONSUMPTION';
  END IF;
END $$;


-- Safe to run multiple times (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType'
      AND e.enumlabel = 'PRODUCTION_CONSUMPTION'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'PRODUCTION_CONSUMPTION';
  END IF;
END $$;









