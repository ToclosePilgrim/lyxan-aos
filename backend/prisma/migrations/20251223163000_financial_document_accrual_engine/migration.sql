-- TZ 6.2 — FinancialDocument accrual engine (posting from document, not from payment)

-- 1) Extend AccountingDocType enum
DO $$
BEGIN
  ALTER TYPE "AccountingDocType" ADD VALUE IF NOT EXISTS 'FINANCIAL_DOCUMENT_ACCRUAL';
  ALTER TYPE "AccountingDocType" ADD VALUE IF NOT EXISTS 'FINANCIAL_DOCUMENT_RECOGNITION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Add accrual flags to financial_documents
ALTER TABLE "financial_documents"
  ADD COLUMN IF NOT EXISTS "isAccrued" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accruedAt" TIMESTAMP(3);

-- 3) Backfill from legacy flag isAccruedToAP
UPDATE "financial_documents"
SET "isAccrued" = true,
    "accruedAt" = COALESCE("accruedAt", "updatedAt")
WHERE "isAccrued" = false
  AND "isAccruedToAP" = true;





