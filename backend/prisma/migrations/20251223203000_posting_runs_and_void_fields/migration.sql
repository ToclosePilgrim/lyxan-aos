-- TZ 8.1 — Posting runs + void fields

-- 1) Posting runs table
CREATE TABLE IF NOT EXISTS "accounting_posting_runs" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "docType" "AccountingDocType" NOT NULL,
  "docId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "postedAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "reversalRunId" TEXT,
  "repostedFromRunId" TEXT,
  CONSTRAINT "accounting_posting_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_posting_runs_doc_ver_key"
  ON "accounting_posting_runs"("docType","docId","version");
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_posting_runs_reversalRunId_key"
  ON "accounting_posting_runs"("reversalRunId");
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_posting_runs_repostedFromRunId_key"
  ON "accounting_posting_runs"("repostedFromRunId");
CREATE INDEX IF NOT EXISTS "accounting_posting_runs_le_doc_idx"
  ON "accounting_posting_runs"("legalEntityId","docType","docId");
CREATE INDEX IF NOT EXISTS "accounting_posting_runs_le_status_posted_idx"
  ON "accounting_posting_runs"("legalEntityId","status","postedAt");

DO $$
BEGIN
  ALTER TABLE "accounting_posting_runs"
    ADD CONSTRAINT "accounting_posting_runs_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "accounting_posting_runs"
    ADD CONSTRAINT "accounting_posting_runs_reversalRunId_fkey"
    FOREIGN KEY ("reversalRunId") REFERENCES "accounting_posting_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "accounting_posting_runs"
    ADD CONSTRAINT "accounting_posting_runs_repostedFromRunId_fkey"
    FOREIGN KEY ("repostedFromRunId") REFERENCES "accounting_posting_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Link entries to posting run
ALTER TABLE "AccountingEntry"
  ADD COLUMN IF NOT EXISTS "postingRunId" TEXT;
CREATE INDEX IF NOT EXISTS "AccountingEntry_postingRunId_idx"
  ON "AccountingEntry"("postingRunId");

DO $$
BEGIN
  ALTER TABLE "AccountingEntry"
    ADD CONSTRAINT "AccountingEntry_postingRunId_fkey"
    FOREIGN KEY ("postingRunId") REFERENCES "accounting_posting_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 3) MoneyTransaction void fields
ALTER TABLE "money_transactions"
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT;


