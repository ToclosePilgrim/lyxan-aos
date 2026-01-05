/*
  Warnings:

  - You are about to drop the column `brandId` on the `marketplaces` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "marketplaces" DROP CONSTRAINT "marketplaces_brandId_fkey";

-- DropIndex
DROP INDEX "marketplaces_brandId_idx";

-- AlterTable
ALTER TABLE "marketplaces" DROP COLUMN "brandId",
ADD COLUMN     "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "marketplace_countries" (
    "marketplaceId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "marketplace_countries_pkey" PRIMARY KEY ("marketplaceId","countryId")
);

-- CreateIndex
CREATE INDEX "marketplace_countries_marketplaceId_idx" ON "marketplace_countries"("marketplaceId");

-- CreateIndex
CREATE INDEX "marketplace_countries_countryId_idx" ON "marketplace_countries"("countryId");

-- AddForeignKey
ALTER TABLE "marketplace_countries" ADD CONSTRAINT "marketplace_countries_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_countries" ADD CONSTRAINT "marketplace_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
