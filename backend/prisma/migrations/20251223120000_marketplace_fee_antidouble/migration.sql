-- TZ 5.2 — Marketplace удержания: anti-double-count policy (schema scaffolding)

-- 1) Add new doc type for fee postings created from statement lines
DO $$
BEGIN
  ALTER TYPE "AccountingDocType" ADD VALUE IF NOT EXISTS 'STATEMENT_LINE_FEE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) StatementLine normalization fields (marketplace fee matching scaffold)
ALTER TABLE "statement_lines"
  ADD COLUMN IF NOT EXISTS "operationTypeHint" TEXT,
  ADD COLUMN IF NOT EXISTS "externalOperationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "marketplaceOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "saleDocumentId" TEXT,
  ADD COLUMN IF NOT EXISTS "feeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "cashflowCategoryId" TEXT;

-- 3) Indexes for reconciliation / matching
CREATE INDEX IF NOT EXISTS "statement_lines_operationTypeHint_occurredAt_idx"
  ON "statement_lines" ("operationTypeHint", "occurredAt");

CREATE INDEX IF NOT EXISTS "statement_lines_marketplaceOrderId_idx"
  ON "statement_lines" ("marketplaceOrderId");

CREATE INDEX IF NOT EXISTS "statement_lines_saleDocumentId_idx"
  ON "statement_lines" ("saleDocumentId");

CREATE INDEX IF NOT EXISTS "statement_lines_externalOperationCode_idx"
  ON "statement_lines" ("externalOperationCode");

-- 4) Optional FK links (for future connectors/manual mapping)
DO $$
BEGIN
  ALTER TABLE "statement_lines"
    ADD CONSTRAINT "statement_lines_cashflowCategoryId_fkey"
    FOREIGN KEY ("cashflowCategoryId") REFERENCES "cashflow_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "statement_lines"
    ADD CONSTRAINT "statement_lines_saleDocumentId_fkey"
    FOREIGN KEY ("saleDocumentId") REFERENCES "sales_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;





