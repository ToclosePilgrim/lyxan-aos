-- CreateEnum
CREATE TYPE "ScmComponentSourceType" AS ENUM ('OWN_STOCK', 'PURCHASE_TO_OWN_WAREHOUSE', 'PURCHASE_DIRECT_TO_MANUFACTURE', 'TRANSFER_FROM_OWN_WAREHOUSE', 'THIRD_PARTY_WAREHOUSE');

-- AlterTable
ALTER TABLE "production_order_items" ADD COLUMN     "plannedSupplyId" TEXT,
ADD COLUMN     "plannedTransferId" TEXT,
ADD COLUMN     "sourceType" "ScmComponentSourceType" NOT NULL DEFAULT 'OWN_STOCK',
ADD COLUMN     "sourceWarehouseId" TEXT,
ADD COLUMN     "targetWarehouseId" TEXT;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_targetWarehouseId_fkey" FOREIGN KEY ("targetWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_plannedSupplyId_fkey" FOREIGN KEY ("plannedSupplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
