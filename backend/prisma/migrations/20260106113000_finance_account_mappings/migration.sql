-- TZ 10.0.1 — Account mapping for postings (remove hardcoded CoA codes from business services)
CREATE TABLE IF NOT EXISTS "finance_account_mappings" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "docType" "AccountingDocType" NOT NULL,
  "marketplaceId" TEXT,
  "mapping" JSONB NOT NULL,
  CONSTRAINT "finance_account_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_account_mappings_legalEntityId_docType_marketplaceId_key"
ON "finance_account_mappings" ("legalEntityId", "docType", "marketplaceId");

CREATE INDEX IF NOT EXISTS "finance_account_mappings_docType_idx"
ON "finance_account_mappings" ("docType");

CREATE INDEX IF NOT EXISTS "finance_account_mappings_marketplaceId_idx"
ON "finance_account_mappings" ("marketplaceId");

ALTER TABLE "finance_account_mappings"
ADD CONSTRAINT "finance_account_mappings_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;


