-- TZ 3.2 — PaymentPlan + Payment Calendar

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentPlanStatus') THEN
    CREATE TYPE "PaymentPlanStatus" AS ENUM ('PLANNED','MOVED','CANCELED','EXECUTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payment_plans" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "fromAccountId" TEXT,
  "plannedDate" TIMESTAMP(3) NOT NULL,
  "plannedAmount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "plannedAmountBase" DECIMAL(18,2) NOT NULL,
  "status" "PaymentPlanStatus" NOT NULL DEFAULT 'PLANNED',
  "note" TEXT,
  "movedFromPlanId" TEXT,

  CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_paymentRequestId_fkey"
  FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_fromAccountId_fkey"
  FOREIGN KEY ("fromAccountId") REFERENCES "financial_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payment_plans_legalEntityId_plannedDate_idx"
  ON "payment_plans"("legalEntityId","plannedDate");
CREATE INDEX IF NOT EXISTS "payment_plans_paymentRequestId_idx"
  ON "payment_plans"("paymentRequestId");
CREATE INDEX IF NOT EXISTS "payment_plans_fromAccountId_plannedDate_idx"
  ON "payment_plans"("fromAccountId","plannedDate");

