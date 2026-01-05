-- DropForeignKey
ALTER TABLE "AccountingEntry" DROP CONSTRAINT "AccountingEntry_brandId_fkey";

-- DropForeignKey
ALTER TABLE "AccountingEntry" DROP CONSTRAINT "AccountingEntry_countryId_fkey";

-- AlterTable
ALTER TABLE "AccountingEntry" ALTER COLUMN "countryId" SET NOT NULL,
ALTER COLUMN "brandId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
