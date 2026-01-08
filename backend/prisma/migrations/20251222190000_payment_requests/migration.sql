-- TZ 3.1 — PaymentRequest + FinanceApprovalPolicy (approvals MVP)

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentRequestType') THEN
    CREATE TYPE "PaymentRequestType" AS ENUM (
      'SUPPLY','PRODUCTION','SERVICE','RENT','MARKETING','SALARY','TAX','LOAN','DIVIDEND','TRANSFER','OTHER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentRequestStatus') THEN
    CREATE TYPE "PaymentRequestStatus" AS ENUM (
      'DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELED'
    );
  END IF;
END $$;

-- Finance approval policies
CREATE TABLE IF NOT EXISTS "finance_approval_policies" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "type" "PaymentRequestType",
  "amountBaseFrom" DECIMAL(18,2) NOT NULL,
  "amountBaseTo" DECIMAL(18,2),
  "approverRole" TEXT,
  "approverUserId" TEXT,
  "isAutoApprove" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "finance_approval_policies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_approval_policies"
  ADD CONSTRAINT "finance_approval_policies_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "finance_approval_policies"
  ADD CONSTRAINT "finance_approval_policies_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "finance_approval_policies_legalEntityId_type_idx"
  ON "finance_approval_policies"("legalEntityId","type");
CREATE INDEX IF NOT EXISTS "finance_approval_policies_legalEntityId_amountBaseFrom_idx"
  ON "finance_approval_policies"("legalEntityId","amountBaseFrom");

-- Payment requests
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "type" "PaymentRequestType" NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "plannedPayDate" TIMESTAMP(3) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "counterpartyId" TEXT,
  "financialDocumentId" TEXT,
  "linkedDocType" "FinanceLinkedDocType",
  "linkedDocId" TEXT,
  "cashflowCategoryId" TEXT NOT NULL,
  "pnlCategoryId" TEXT,
  "description" TEXT,
  "attachments" JSONB,
  "requestedByUserId" TEXT,

  "submittedAt" TIMESTAMP(3),
  "submittedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedBy" TEXT,
  "rejectReason" TEXT,

  CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_cashflowCategoryId_fkey"
  FOREIGN KEY ("cashflowCategoryId") REFERENCES "cashflow_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_pnlCategoryId_fkey"
  FOREIGN KEY ("pnlCategoryId") REFERENCES "pnl_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_financialDocumentId_fkey"
  FOREIGN KEY ("financialDocumentId") REFERENCES "financial_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payment_requests_legalEntityId_status_plannedPayDate_idx"
  ON "payment_requests"("legalEntityId","status","plannedPayDate");
CREATE INDEX IF NOT EXISTS "payment_requests_financialDocumentId_idx"
  ON "payment_requests"("financialDocumentId");
CREATE INDEX IF NOT EXISTS "payment_requests_linkedDocType_linkedDocId_idx"
  ON "payment_requests"("linkedDocType","linkedDocId");

