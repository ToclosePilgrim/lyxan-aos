-- TZ 1.2 — FinancialDocument: legalEntityId + classifications + capitalization policy (Step B: enforce NOT NULL + FKs)

-- Re-run backfill to be safe
UPDATE "financial_documents" fd
SET "legalEntityId" = bc."legalEntityId"
FROM "scm_supplies" s
JOIN "warehouses" w ON w."id" = s."warehouseId"
JOIN "brand_countries" bc
  ON bc."brandId" = s."brandId"
 AND bc."countryId" = w."countryId"
WHERE fd."legalEntityId" IS NULL
  AND bc."legalEntityId" IS NOT NULL
  AND (
    (fd."linkedDocType" = 'SUPPLY' AND fd."linkedDocId" = s."id")
    OR (fd."scmSupplyId" IS NOT NULL AND fd."scmSupplyId" = s."id")
    OR (fd."sourceDocType" = 'SUPPLY' AND fd."sourceDocId" = s."id")
  );

UPDATE "financial_documents" fd
SET "legalEntityId" = bc."legalEntityId"
FROM "production_orders" po
JOIN "scm_products" p ON p."id" = po."productId"
JOIN "warehouses" w ON w."id" = COALESCE(po."warehouseId", po."outputWarehouseId")
JOIN "brand_countries" bc
  ON bc."brandId" = p."brandId"
 AND bc."countryId" = w."countryId"
WHERE fd."legalEntityId" IS NULL
  AND bc."legalEntityId" IS NOT NULL
  AND (
    (fd."linkedDocType" = 'PRODUCTION_ORDER' AND fd."linkedDocId" = po."id")
    OR (fd."productionOrderId" IS NOT NULL AND fd."productionOrderId" = po."id")
  );

-- Backfill from linked SalesDocument (brandId + countryId already on sales_documents)
UPDATE "financial_documents" fd
SET "legalEntityId" = bc."legalEntityId"
FROM "sales_documents" sd
JOIN "brand_countries" bc
  ON bc."brandId" = sd."brandId"
 AND bc."countryId" = sd."countryId"
WHERE fd."legalEntityId" IS NULL
  AND bc."legalEntityId" IS NOT NULL
  AND (
    (fd."linkedDocType" = 'SALES_DOCUMENT' AND fd."linkedDocId" = sd."id")
    OR (sd."financialDocumentId" = fd."id")
  );

-- Fail fast if coverage is not 100%
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "financial_documents" WHERE "legalEntityId" IS NULL) THEN
    RAISE EXCEPTION 'TZ 1.2: financial_documents.legalEntityId backfill incomplete. Fix documents without legalEntityId (manual), or ensure they link to SUPPLY/PRODUCTION_ORDER with BrandCountry.legalEntityId configured.';
  END IF;
END $$;

ALTER TABLE "financial_documents"
  ALTER COLUMN "legalEntityId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_documents_legalEntityId_fkey') THEN
    ALTER TABLE "financial_documents"
      ADD CONSTRAINT "financial_documents_legalEntityId_fkey"
      FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_documents_pnlCategoryId_fkey') THEN
    ALTER TABLE "financial_documents"
      ADD CONSTRAINT "financial_documents_pnlCategoryId_fkey"
      FOREIGN KEY ("pnlCategoryId") REFERENCES "pnl_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_documents_cashflowCategoryId_fkey') THEN
    ALTER TABLE "financial_documents"
      ADD CONSTRAINT "financial_documents_cashflowCategoryId_fkey"
      FOREIGN KEY ("cashflowCategoryId") REFERENCES "cashflow_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
