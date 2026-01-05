-- TZ 6.3 — Recurring journals + runs (monthly recognition / depreciation)

-- 1) Add usefulLifeMonths to financial_documents
ALTER TABLE "financial_documents"
  ADD COLUMN IF NOT EXISTS "usefulLifeMonths" INTEGER;

-- 2) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringJournalType') THEN
    CREATE TYPE "RecurringJournalType" AS ENUM (
      'PREPAID_RECOGNITION',
      'DEPRECIATION',
      'AMORTIZATION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringJournalStatus') THEN
    CREATE TYPE "RecurringJournalStatus" AS ENUM (
      'ACTIVE',
      'PAUSED',
      'ARCHIVED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringJournalFrequency') THEN
    CREATE TYPE "RecurringJournalFrequency" AS ENUM ('MONTHLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JournalRunStatus') THEN
    CREATE TYPE "JournalRunStatus" AS ENUM ('POSTED','SKIPPED','ERROR');
  END IF;
END $$;

-- 3) Tables
CREATE TABLE IF NOT EXISTS "recurring_journals" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "sourceDocumentId" TEXT,
  "journalType" "RecurringJournalType" NOT NULL,
  "status" "RecurringJournalStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "frequency" "RecurringJournalFrequency" NOT NULL DEFAULT 'MONTHLY',
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "debitAccountId" TEXT NOT NULL,
  "creditAccountId" TEXT NOT NULL,
  "pnlCategoryId" TEXT,
  "cashflowCategoryId" TEXT,
  CONSTRAINT "recurring_journals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recurring_journals_legal_status_type_idx"
  ON "recurring_journals"("legalEntityId","status","journalType");
CREATE INDEX IF NOT EXISTS "recurring_journals_sourceDocumentId_idx"
  ON "recurring_journals"("sourceDocumentId");

DO $$
BEGIN
  ALTER TABLE "recurring_journals"
    ADD CONSTRAINT "recurring_journals_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "recurring_journals"
    ADD CONSTRAINT "recurring_journals_sourceDocumentId_fkey"
    FOREIGN KEY ("sourceDocumentId") REFERENCES "financial_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "recurring_journals"
    ADD CONSTRAINT "recurring_journals_pnlCategoryId_fkey"
    FOREIGN KEY ("pnlCategoryId") REFERENCES "pnl_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "recurring_journals"
    ADD CONSTRAINT "recurring_journals_cashflowCategoryId_fkey"
    FOREIGN KEY ("cashflowCategoryId") REFERENCES "cashflow_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "recurring_journal_runs" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recurringJournalId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL,
  "status" "JournalRunStatus" NOT NULL,
  "accountingEntryId" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "recurring_journal_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recurring_journal_runs_unique_period"
  ON "recurring_journal_runs"("recurringJournalId","periodStart","periodEnd");
CREATE INDEX IF NOT EXISTS "recurring_journal_runs_journal_period_idx"
  ON "recurring_journal_runs"("recurringJournalId","periodStart");

DO $$
BEGIN
  ALTER TABLE "recurring_journal_runs"
    ADD CONSTRAINT "recurring_journal_runs_recurringJournalId_fkey"
    FOREIGN KEY ("recurringJournalId") REFERENCES "recurring_journals"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "recurring_journal_runs"
    ADD CONSTRAINT "recurring_journal_runs_accountingEntryId_fkey"
    FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;


