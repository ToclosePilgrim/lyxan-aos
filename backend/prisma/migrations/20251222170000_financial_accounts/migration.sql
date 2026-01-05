-- TZ 2.1 — FinancialAccount (money containers)

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialAccountType') THEN
    CREATE TYPE "FinancialAccountType" AS ENUM (
      'CASHBOX',
      'BANK_ACCOUNT',
      'ACQUIRING_ACCOUNT',
      'MARKETPLACE_WALLET',
      'OTHER_CLEARING'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialAccountStatus') THEN
    CREATE TYPE "FinancialAccountStatus" AS ENUM ('ACTIVE','ARCHIVED');
  END IF;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS "financial_accounts" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL,
  "currency" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT,
  "externalRef" TEXT,
  "status" "FinancialAccountStatus" NOT NULL DEFAULT 'ACTIVE',

  CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "financial_accounts"
  DROP CONSTRAINT IF EXISTS "financial_accounts_legalEntityId_fkey";

ALTER TABLE "financial_accounts"
  ADD CONSTRAINT "financial_accounts_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "financial_accounts_legalEntityId_type_idx"
  ON "financial_accounts"("legalEntityId","type");
CREATE INDEX IF NOT EXISTS "financial_accounts_legalEntityId_currency_idx"
  ON "financial_accounts"("legalEntityId","currency");

-- Best-practice uniqueness for "external" accounts:
-- Prevent duplicates when externalRef is set; treat NULL provider as empty string.
CREATE UNIQUE INDEX IF NOT EXISTS "financial_accounts_unique_external_ref"
  ON "financial_accounts"("legalEntityId","type",(COALESCE("provider",'')),"externalRef")
  WHERE "externalRef" IS NOT NULL;
