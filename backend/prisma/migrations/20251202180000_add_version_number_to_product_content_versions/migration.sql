-- AlterTable: Add versionNumber column to product_content_versions
ALTER TABLE "product_content_versions" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER;

-- Update existing versions with sequential numbers per product
DO $$
DECLARE
    product_rec RECORD;
    version_num INTEGER;
BEGIN
    FOR product_rec IN SELECT DISTINCT "productId" FROM "product_content_versions" ORDER BY "productId"
    LOOP
        version_num := 1;
        UPDATE "product_content_versions"
        SET "versionNumber" = version_num
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
            FROM "product_content_versions"
            WHERE "productId" = product_rec."productId"
        ) AS numbered
        WHERE "product_content_versions".id = numbered.id
        AND "product_content_versions"."productId" = product_rec."productId";
        
        -- Set version numbers sequentially
        UPDATE "product_content_versions"
        SET "versionNumber" = subquery.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
            FROM "product_content_versions"
            WHERE "productId" = product_rec."productId"
        ) AS subquery
        WHERE "product_content_versions".id = subquery.id;
    END LOOP;
END $$;

-- Make versionNumber NOT NULL after populating
ALTER TABLE "product_content_versions" ALTER COLUMN "versionNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_content_versions_productId_versionNumber_key" ON "product_content_versions"("productId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_content_versions_productId_versionNumber_idx" ON "product_content_versions"("productId", "versionNumber");




