-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN "productionCountryId" TEXT,
ADD COLUMN "manufacturerId" TEXT;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productionCountryId_fkey" FOREIGN KEY ("productionCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "production_orders_productionCountryId_idx" ON "production_orders"("productionCountryId");

-- CreateIndex
CREATE INDEX "production_orders_manufacturerId_idx" ON "production_orders"("manufacturerId");




