-- CreateEnum
CREATE TYPE "BatchSourceType" AS ENUM ('SUPPLY', 'PRODUCTION', 'TRANSFER', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INCOME', 'OUTCOME');

-- CreateEnum
CREATE TYPE "MovementDocType" AS ENUM ('SUPPLY', 'TRANSFER', 'PRODUCTION_INPUT', 'PRODUCTION_OUTPUT', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "costPerUnit" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "sourceType" "BatchSourceType" NOT NULL,
    "sourceDocId" TEXT,
    "productionOrderItemId" TEXT,
    "supplyItemId" TEXT,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "costPerUnit" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "movementType" "MovementType" NOT NULL,
    "docType" "MovementDocType" NOT NULL,
    "docId" TEXT,
    "supplyItemId" TEXT,
    "productionOrderItemId" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_batches_warehouseId_idx" ON "stock_batches"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_batches_itemId_idx" ON "stock_batches"("itemId");

-- CreateIndex
CREATE INDEX "stock_batches_sourceDocId_idx" ON "stock_batches"("sourceDocId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_idx" ON "stock_movements"("itemId");

-- CreateIndex
CREATE INDEX "stock_movements_docId_idx" ON "stock_movements"("docId");

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "production_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "scm_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "scm_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "production_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
