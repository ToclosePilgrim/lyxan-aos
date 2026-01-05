-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN     "outputWarehouseId" TEXT;

-- CreateIndex
CREATE INDEX "production_orders_outputWarehouseId_idx" ON "production_orders"("outputWarehouseId");

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_outputWarehouseId_fkey" FOREIGN KEY ("outputWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
