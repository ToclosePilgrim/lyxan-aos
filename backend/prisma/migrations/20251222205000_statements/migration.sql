-- TZ 4.1 — Statements & StatementLines (storage + idempotent import)

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatementProvider') THEN
    CREATE TYPE "StatementProvider" AS ENUM ('BANK','ACQUIRING','MARKETPLACE','OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatementStatus') THEN
    CREATE TYPE "StatementStatus" AS ENUM ('IMPORTED','ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatementLineStatus') THEN
    CREATE TYPE "StatementLineStatus" AS ENUM ('NEW','SUGGESTED','MATCHED','POSTED','IGNORED','ERROR');
  END IF;
END $$;

-- statements
CREATE TABLE IF NOT EXISTS "statements" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" "StatementProvider" NOT NULL,
  "sourceName" TEXT,
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importHash" TEXT NOT NULL,
  "status" "StatementStatus" NOT NULL DEFAULT 'IMPORTED',
  "raw" JSONB,

  CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "statements"
  ADD CONSTRAINT "statements_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "statements"
  ADD CONSTRAINT "statements_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "statements_accountId_importHash_key"
  ON "statements"("accountId","importHash");

CREATE INDEX IF NOT EXISTS "statements_legalEntityId_accountId_importedAt_idx"
  ON "statements"("legalEntityId","accountId","importedAt");

-- statement_lines
CREATE TABLE IF NOT EXISTS "statement_lines" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "statementId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "lineIndex" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "direction" "MoneyTransactionDirection" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "description" TEXT,
  "counterpartyName" TEXT,
  "counterpartyInn" TEXT,
  "bankReference" TEXT,
  "externalLineId" TEXT,
  "lineHash" TEXT NOT NULL,
  "status" "StatementLineStatus" NOT NULL DEFAULT 'NEW',
  "errorMessage" TEXT,
  "suggestedMatch" JSONB,
  "matchedEntityType" TEXT,
  "matchedEntityId" TEXT,
  "postedMoneyTransactionId" TEXT,
  "postedAt" TIMESTAMP(3),

  CONSTRAINT "statement_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "statement_lines"
  ADD CONSTRAINT "statement_lines_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "statements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "statement_lines"
  ADD CONSTRAINT "statement_lines_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "statement_lines"
  ADD CONSTRAINT "statement_lines_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "statement_lines_statementId_lineIndex_key"
  ON "statement_lines"("statementId","lineIndex");

CREATE UNIQUE INDEX IF NOT EXISTS "statement_lines_accountId_lineHash_key"
  ON "statement_lines"("accountId","lineHash");

CREATE INDEX IF NOT EXISTS "statement_lines_accountId_occurredAt_idx"
  ON "statement_lines"("accountId","occurredAt");

CREATE INDEX IF NOT EXISTS "statement_lines_legalEntityId_status_occurredAt_idx"
  ON "statement_lines"("legalEntityId","status","occurredAt");

CREATE INDEX IF NOT EXISTS "statement_lines_accountId_externalLineId_idx"
  ON "statement_lines"("accountId","externalLineId");

-- Partial unique for externalLineId when provided
CREATE UNIQUE INDEX IF NOT EXISTS "statement_lines_accountId_externalLineId_unique"
  ON "statement_lines"("accountId","externalLineId")
  WHERE "externalLineId" IS NOT NULL;


