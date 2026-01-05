-- TZ 2.2 — MoneyTransaction (fact of cash movement by FinancialAccount)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MoneyTransactionSourceType') THEN
    CREATE TYPE "MoneyTransactionSourceType" AS ENUM (
      'STATEMENT_LINE',
      'PAYMENT_EXECUTION',
      'INTERNAL_TRANSFER',
      'MANUAL'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MoneyTransactionDirection') THEN
    CREATE TYPE "MoneyTransactionDirection" AS ENUM ('IN','OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MoneyTransactionStatus') THEN
    CREATE TYPE "MoneyTransactionStatus" AS ENUM ('POSTED','VOIDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "money_transactions" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "direction" "MoneyTransactionDirection" NOT NULL,
  "amount" DECIMAL(14,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(14,4) NOT NULL,
  "description" TEXT,
  "counterpartyId" TEXT,
  "sourceType" "MoneyTransactionSourceType" NOT NULL,
  "sourceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "MoneyTransactionStatus" NOT NULL DEFAULT 'POSTED',

  CONSTRAINT "money_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "money_transactions"
  DROP CONSTRAINT IF EXISTS "money_transactions_accountId_fkey";

ALTER TABLE "money_transactions"
  ADD CONSTRAINT "money_transactions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "money_transactions"
  DROP CONSTRAINT IF EXISTS "money_transactions_counterpartyId_fkey";

ALTER TABLE "money_transactions"
  ADD CONSTRAINT "money_transactions_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "money_transactions_accountId_idempotencyKey_key"
  ON "money_transactions"("accountId","idempotencyKey");
CREATE INDEX IF NOT EXISTS "money_transactions_accountId_occurredAt_idx"
  ON "money_transactions"("accountId","occurredAt");
CREATE INDEX IF NOT EXISTS "money_transactions_sourceType_sourceId_idx"
  ON "money_transactions"("sourceType","sourceId");
