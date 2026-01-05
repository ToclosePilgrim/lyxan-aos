-- TZ 2.3 — CashAccountingLink (MoneyTransaction ↔ AccountingEntry)

-- 1) Extend AccountingDocType enum (Postgres enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType'
      AND e.enumlabel = 'INTERNAL_TRANSFER'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'INTERNAL_TRANSFER';
  END IF;
END $$;

-- 2) CashAccountingLinkRole enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashAccountingLinkRole') THEN
    CREATE TYPE "CashAccountingLinkRole" AS ENUM (
      'PAYMENT_PRINCIPAL',
      'FEE',
      'PAYOUT',
      'REFUND',
      'TRANSFER',
      'ADJUSTMENT'
    );
  END IF;
END $$;

-- 3) Table
CREATE TABLE IF NOT EXISTS "cash_accounting_links" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moneyTransactionId" TEXT NOT NULL,
  "accountingEntryId" TEXT NOT NULL,
  "role" "CashAccountingLinkRole" NOT NULL,

  CONSTRAINT "cash_accounting_links_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cash_accounting_links"
  DROP CONSTRAINT IF EXISTS "cash_accounting_links_moneyTransactionId_fkey";

ALTER TABLE "cash_accounting_links"
  ADD CONSTRAINT "cash_accounting_links_moneyTransactionId_fkey"
  FOREIGN KEY ("moneyTransactionId") REFERENCES "money_transactions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_accounting_links"
  DROP CONSTRAINT IF EXISTS "cash_accounting_links_accountingEntryId_fkey";

ALTER TABLE "cash_accounting_links"
  ADD CONSTRAINT "cash_accounting_links_accountingEntryId_fkey"
  FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "cash_accounting_links_unique"
  ON "cash_accounting_links"("moneyTransactionId","accountingEntryId","role");
CREATE INDEX IF NOT EXISTS "cash_accounting_links_accountingEntryId_idx"
  ON "cash_accounting_links"("accountingEntryId");
CREATE INDEX IF NOT EXISTS "cash_accounting_links_moneyTransactionId_idx"
  ON "cash_accounting_links"("moneyTransactionId");
