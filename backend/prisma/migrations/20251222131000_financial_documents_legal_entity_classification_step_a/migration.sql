-- TZ 1.2 — FinancialDocument: legalEntityId + classifications + capitalization policy (Step A: add nullable + backfill)

-- 1) Add category dictionaries (MVP)
CREATE TABLE IF NOT EXISTS "pnl_categories" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "pnl_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pnl_categories_code_key" ON "pnl_categories"("code");
CREATE INDEX IF NOT EXISTS "pnl_categories_parentId_idx" ON "pnl_categories"("parentId");
CREATE INDEX IF NOT EXISTS "pnl_categories_isActive_idx" ON "pnl_categories"("isActive");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnl_categories_parentId_fkey') THEN
    ALTER TABLE "pnl_categories"
      ADD CONSTRAINT "pnl_categories_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "pnl_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cashflow_categories" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "cashflow_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cashflow_categories_code_key" ON "cashflow_categories"("code");
CREATE INDEX IF NOT EXISTS "cashflow_categories_parentId_idx" ON "cashflow_categories"("parentId");
CREATE INDEX IF NOT EXISTS "cashflow_categories_isActive_idx" ON "cashflow_categories"("isActive");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cashflow_categories_parentId_fkey') THEN
    ALTER TABLE "cashflow_categories"
      ADD CONSTRAINT "cashflow_categories_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "cashflow_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Add new columns to financial_documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceCapitalizationPolicy') THEN
    CREATE TYPE "FinanceCapitalizationPolicy" AS ENUM (
      'EXPENSE_IMMEDIATE',
      'PREPAID_EXPENSE',
      'FIXED_ASSET',
      'INTANGIBLE',
      'INVENTORY'
    );
  END IF;
END $$;

ALTER TABLE "financial_documents"
  ADD COLUMN "legalEntityId" TEXT,
  ADD COLUMN "pnlCategoryId" TEXT,
  ADD COLUMN "cashflowCategoryId" TEXT,
  ADD COLUMN "capitalizationPolicy" "FinanceCapitalizationPolicy" NOT NULL DEFAULT 'EXPENSE_IMMEDIATE',
  ADD COLUMN "recognizedFrom" TIMESTAMP(3),
  ADD COLUMN "recognizedTo" TIMESTAMP(3);

-- Ensure scm_supplies has brandId before backfill (migrations order safety)
ALTER TABLE "scm_supplies" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

-- 3) Backfill legalEntityId from linked Supply (via supply.brandId + supply.warehouse.countryId -> brand_countries.legalEntityId)
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
  );

-- 4) Backfill legalEntityId from linked Production Order (via product.brandId + warehouse.countryId)
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

-- 5) Indexes (requested)
CREATE INDEX IF NOT EXISTS "financial_documents_legalEntityId_docDate_idx"
  ON "financial_documents"("legalEntityId","docDate");
CREATE INDEX IF NOT EXISTS "financial_documents_legalEntityId_status_idx"
  ON "financial_documents"("legalEntityId","status");

-- FKs for categories are added in Step B (after manual fixes if needed).
