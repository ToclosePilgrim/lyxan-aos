/*
  A.2-final — hard delete legacy Product/Sku/Stock/Supply/SupplyItem + FinanceReport
  Also removes legacy BCM content versioning tables tied to Product, and drops skuId/productId from SalesDocumentLine.

  IMPORTANT: This migration includes data backfill steps BEFORE dropping legacy columns/tables.
*/

-- 1) Drop FKs from legacy tables and legacy references
ALTER TABLE "finance_reports" DROP CONSTRAINT IF EXISTS "finance_reports_sales_document_id_fkey";
ALTER TABLE "finance_reports" DROP CONSTRAINT IF EXISTS "finance_reports_sales_document_line_id_fkey";
ALTER TABLE "finance_reports" DROP CONSTRAINT IF EXISTS "finance_reports_skuId_fkey";

ALTER TABLE "listing_content_versions" DROP CONSTRAINT IF EXISTS "listing_content_versions_createdByUserId_fkey";
ALTER TABLE "listing_content_versions" DROP CONSTRAINT IF EXISTS "listing_content_versions_listingId_fkey";
ALTER TABLE "listing_content_versions" DROP CONSTRAINT IF EXISTS "listing_content_versions_marketplaceId_fkey";

ALTER TABLE "product_cards" DROP CONSTRAINT IF EXISTS "product_cards_productId_fkey";

ALTER TABLE "product_content_versions" DROP CONSTRAINT IF EXISTS "product_content_versions_productId_fkey";
ALTER TABLE "product_content_versions" DROP CONSTRAINT IF EXISTS "product_content_versions_userId_fkey";

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_brandId_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_marketplaceId_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_scmProductId_fkey";

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_skuId_fkey";

ALTER TABLE "sales_document_lines" DROP CONSTRAINT IF EXISTS "sales_document_lines_productId_fkey";
ALTER TABLE "sales_document_lines" DROP CONSTRAINT IF EXISTS "sales_document_lines_skuId_fkey";
ALTER TABLE "sales_document_lines" DROP CONSTRAINT IF EXISTS "sales_document_lines_scmProductId_fkey";

ALTER TABLE "scm_supply_items" DROP CONSTRAINT IF EXISTS "scm_supply_items_productId_fkey";

ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_productId_fkey";
ALTER TABLE "stocks" DROP CONSTRAINT IF EXISTS "stocks_skuId_fkey";
ALTER TABLE "supply_items" DROP CONSTRAINT IF EXISTS "supply_items_skuId_fkey";
ALTER TABLE "supply_items" DROP CONSTRAINT IF EXISTS "supply_items_supplyId_fkey";

ALTER TABLE "inventory_balances" DROP CONSTRAINT IF EXISTS "inventory_balances_productId_fkey";
ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_productId_fkey";

-- 2) Add new columns (do NOT drop old yet)
ALTER TABLE "inventory_balances" ADD COLUMN IF NOT EXISTS "scmProductId" TEXT;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "scmProductId" TEXT;
ALTER TABLE "scm_supply_items" ADD COLUMN IF NOT EXISTS "scmProductId" TEXT;

-- 3) Backfill new columns from legacy Product->scmProductId mapping
UPDATE "inventory_balances" ib
SET "scmProductId" = p."scmProductId"
FROM "products" p
WHERE ib."productId" = p."id"
  AND ib."scmProductId" IS NULL;

UPDATE "inventory_transactions" it
SET "scmProductId" = p."scmProductId"
FROM "products" p
WHERE it."productId" = p."id"
  AND it."scmProductId" IS NULL;

UPDATE "scm_supply_items" ssi
SET "scmProductId" = p."scmProductId"
FROM "products" p
WHERE ssi."productId" = p."id"
  AND ssi."scmProductId" IS NULL;

-- 4) Backfill SalesDocumentLine.scmProductId from itemId when possible (D.3+ / A.2-final)
UPDATE "sales_document_lines" sdl
SET "scmProductId" = sdl."itemId"
WHERE sdl."scmProductId" IS NULL
  AND sdl."itemId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "scm_products" sp WHERE sp."id" = sdl."itemId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sales_document_lines" WHERE "scmProductId" IS NULL) THEN
    RAISE EXCEPTION 'A.2-final migration: sales_document_lines.scmProductId still NULL; backfill required';
  END IF;
END $$;

-- 5) Drop legacy indexes before dropping columns/tables
DROP INDEX IF EXISTS "inventory_balances_productId_idx";
DROP INDEX IF EXISTS "inventory_balances_warehouseId_productId_supplierItemId_key";
DROP INDEX IF EXISTS "inventory_transactions_productId_idx";
DROP INDEX IF EXISTS "reviews_skuId_idx";
DROP INDEX IF EXISTS "sales_document_lines_productId_idx";
DROP INDEX IF EXISTS "sales_document_lines_skuId_idx";
DROP INDEX IF EXISTS "scm_supply_items_productId_idx";

-- 6) Alter tables: drop legacy columns, enforce NOT NULL where required by new schema
ALTER TABLE "inventory_balances" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "inventory_transactions" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "scm_supply_items" DROP COLUMN IF EXISTS "productId";

ALTER TABLE "reviews" DROP COLUMN IF EXISTS "skuId";

ALTER TABLE "sales_document_lines" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "sales_document_lines" DROP COLUMN IF EXISTS "skuId";
ALTER TABLE "sales_document_lines" ALTER COLUMN "scmProductId" SET NOT NULL;

-- 7) Drop legacy tables
DROP TABLE IF EXISTS "finance_reports";
DROP TABLE IF EXISTS "listing_content_versions";
DROP TABLE IF EXISTS "product_cards";
DROP TABLE IF EXISTS "product_content_versions";
DROP TABLE IF EXISTS "stocks";
DROP TABLE IF EXISTS "supply_items";
DROP TABLE IF EXISTS "supplies";
DROP TABLE IF EXISTS "skus";
DROP TABLE IF EXISTS "products";

-- 8) Drop legacy enums (BCM v1)
DROP TYPE IF EXISTS "ContentChangeSource";
DROP TYPE IF EXISTS "ListingVersionSource";

-- 9) Create new indexes/constraints
CREATE INDEX IF NOT EXISTS "inventory_balances_scmProductId_idx" ON "inventory_balances"("scmProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_balances_warehouseId_scmProductId_supplierItemId_key"
  ON "inventory_balances"("warehouseId", "scmProductId", "supplierItemId");

CREATE INDEX IF NOT EXISTS "inventory_transactions_scmProductId_idx" ON "inventory_transactions"("scmProductId");
CREATE INDEX IF NOT EXISTS "scm_supply_items_scmProductId_idx" ON "scm_supply_items"("scmProductId");

-- 10) Add new FKs to ScmProduct
ALTER TABLE "sales_document_lines"
  ADD CONSTRAINT "sales_document_lines_scmProductId_fkey"
  FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scm_supply_items"
  ADD CONSTRAINT "scm_supply_items_scmProductId_fkey"
  FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_scmProductId_fkey"
  FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_scmProductId_fkey"
  FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;


















