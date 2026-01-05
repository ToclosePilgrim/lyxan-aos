-- TZ 5.1 — CashTransfer (marketplace payout pairing + posting)

-- 1) Enum additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType' AND e.enumlabel = 'MARKETPLACE_PAYOUT_TRANSFER'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'MARKETPLACE_PAYOUT_TRANSFER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashTransferStatus') THEN
    CREATE TYPE "CashTransferStatus" AS ENUM ('PAIRED','POSTED','CANCELED');
  END IF;
END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS "cash_transfers" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "toAccountId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "provider" TEXT,
  "externalRef" TEXT,
  "walletStatementLineId" TEXT,
  "bankStatementLineId" TEXT,
  "status" "CashTransferStatus" NOT NULL DEFAULT 'PAIRED',

  CONSTRAINT "cash_transfers_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_legalEntityId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_legalEntityId_fkey"
      FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_fromAccountId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_fromAccountId_fkey"
      FOREIGN KEY ("fromAccountId") REFERENCES "financial_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_toAccountId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_toAccountId_fkey"
      FOREIGN KEY ("toAccountId") REFERENCES "financial_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_walletStatementLineId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_walletStatementLineId_fkey"
      FOREIGN KEY ("walletStatementLineId") REFERENCES "statement_lines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_bankStatementLineId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_bankStatementLineId_fkey"
      FOREIGN KEY ("bankStatementLineId") REFERENCES "statement_lines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cash_transfers_legalEntityId_occurredAt_idx"
  ON "cash_transfers"("legalEntityId","occurredAt");
CREATE INDEX IF NOT EXISTS "cash_transfers_fromAccountId_toAccountId_occurredAt_idx"
  ON "cash_transfers"("fromAccountId","toAccountId","occurredAt");

-- Unique when both provider and externalRef are provided; Postgres UNIQUE allows multiple NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS "cash_transfers_legalEntityId_provider_externalRef_key"
  ON "cash_transfers"("legalEntityId","provider","externalRef");



-- 1) Enum additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType' AND e.enumlabel = 'MARKETPLACE_PAYOUT_TRANSFER'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'MARKETPLACE_PAYOUT_TRANSFER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashTransferStatus') THEN
    CREATE TYPE "CashTransferStatus" AS ENUM ('PAIRED','POSTED','CANCELED');
  END IF;
END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS "cash_transfers" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "toAccountId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "provider" TEXT,
  "externalRef" TEXT,
  "walletStatementLineId" TEXT,
  "bankStatementLineId" TEXT,
  "status" "CashTransferStatus" NOT NULL DEFAULT 'PAIRED',

  CONSTRAINT "cash_transfers_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_legalEntityId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_legalEntityId_fkey"
      FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_fromAccountId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_fromAccountId_fkey"
      FOREIGN KEY ("fromAccountId") REFERENCES "financial_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_toAccountId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_toAccountId_fkey"
      FOREIGN KEY ("toAccountId") REFERENCES "financial_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_walletStatementLineId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_walletStatementLineId_fkey"
      FOREIGN KEY ("walletStatementLineId") REFERENCES "statement_lines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_transfers_bankStatementLineId_fkey') THEN
    ALTER TABLE "cash_transfers"
      ADD CONSTRAINT "cash_transfers_bankStatementLineId_fkey"
      FOREIGN KEY ("bankStatementLineId") REFERENCES "statement_lines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cash_transfers_legalEntityId_occurredAt_idx"
  ON "cash_transfers"("legalEntityId","occurredAt");
CREATE INDEX IF NOT EXISTS "cash_transfers_fromAccountId_toAccountId_occurredAt_idx"
  ON "cash_transfers"("fromAccountId","toAccountId","occurredAt");

-- Unique when both provider and externalRef are provided; Postgres UNIQUE allows multiple NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS "cash_transfers_legalEntityId_provider_externalRef_key"
  ON "cash_transfers"("legalEntityId","provider","externalRef");






