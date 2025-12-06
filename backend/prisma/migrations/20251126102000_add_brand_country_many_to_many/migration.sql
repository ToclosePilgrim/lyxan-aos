-- CreateTable
CREATE TABLE "brand_countries" (
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "brand_countries_pkey" PRIMARY KEY ("brandId","countryId")
);

-- Migrate existing data from brands.countryId to brand_countries
INSERT INTO "brand_countries" ("brandId", "countryId")
SELECT id, "countryId" FROM "brands" WHERE "countryId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "brand_countries_brandId_idx" ON "brand_countries"("brandId");

-- CreateIndex
CREATE INDEX "brand_countries_countryId_idx" ON "brand_countries"("countryId");

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX IF EXISTS "brands_countryId_idx";

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "countryId";





