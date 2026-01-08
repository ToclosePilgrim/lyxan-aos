-- TZ 3.3 — PaymentExecution + statuses

-- 1) Extend PaymentRequestStatus enum (Postgres enum)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentRequestStatus') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'PaymentRequestStatus' AND e.enumlabel = 'PARTIALLY_PAID'
    ) THEN
      ALTER TYPE "PaymentRequestStatus" ADD VALUE 'PARTIALLY_PAID';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'PaymentRequestStatus' AND e.enumlabel = 'PAID'
    ) THEN
      ALTER TYPE "PaymentRequestStatus" ADD VALUE 'PAID';
    END IF;
  END IF;
END $$;

-- 2) Extend AccountingDocType enum with PAYMENT_EXECUTION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountingDocType') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'AccountingDocType' AND e.enumlabel = 'PAYMENT_EXECUTION'
    ) THEN
      ALTER TYPE "AccountingDocType" ADD VALUE 'PAYMENT_EXECUTION';
    END IF;
  END IF;
END $$;

-- 3) Add FinancialDocument.isAccruedToAP
ALTER TABLE "financial_documents" ADD COLUMN IF NOT EXISTS "isAccruedToAP" BOOLEAN NOT NULL DEFAULT false;

-- 4) PaymentExecutionStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentExecutionStatus') THEN
    CREATE TYPE "PaymentExecutionStatus" AS ENUM ('EXECUTED','CANCELED','REVERSED');
  END IF;
END $$;

-- 5) payment_executions table
CREATE TABLE IF NOT EXISTS "payment_executions" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "paymentPlanId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "executedAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "bankReference" TEXT,
  "description" TEXT,
  "status" "PaymentExecutionStatus" NOT NULL DEFAULT 'EXECUTED',

  CONSTRAINT "payment_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_executions_paymentPlanId_key"
  ON "payment_executions"("paymentPlanId");

ALTER TABLE "payment_executions"
  ADD CONSTRAINT "payment_executions_paymentPlanId_fkey"
  FOREIGN KEY ("paymentPlanId") REFERENCES "payment_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_executions"
  ADD CONSTRAINT "payment_executions_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_executions"
  ADD CONSTRAINT "payment_executions_fromAccountId_fkey"
  FOREIGN KEY ("fromAccountId") REFERENCES "financial_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payment_executions_legalEntityId_executedAt_idx"
  ON "payment_executions"("legalEntityId","executedAt");
CREATE INDEX IF NOT EXISTS "payment_executions_fromAccountId_executedAt_idx"
  ON "payment_executions"("fromAccountId","executedAt");

