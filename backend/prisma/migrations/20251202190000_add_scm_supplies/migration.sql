-- CreateEnum: ScmSupplyStatus
DO $$ BEGIN
    CREATE TYPE "ScmSupplyStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: scm_supplies
CREATE TABLE IF NOT EXISTS "scm_supplies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ScmSupplyStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "totalAmount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "orderDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "scm_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: scm_supply_items
CREATE TABLE IF NOT EXISTS "scm_supply_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplyId" TEXT NOT NULL,
    "supplierItemId" TEXT,
    "productId" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "pricePerUnit" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "productionOrderItemId" TEXT,

    CONSTRAINT "scm_supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "scm_supplies_code_key" ON "scm_supplies"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supplies_supplierId_idx" ON "scm_supplies"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supplies_warehouseId_idx" ON "scm_supplies"("warehouseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supplies_productionOrderId_idx" ON "scm_supplies"("productionOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supplies_status_idx" ON "scm_supplies"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supplies_code_idx" ON "scm_supplies"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supply_items_supplyId_idx" ON "scm_supply_items"("supplyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supply_items_supplierItemId_idx" ON "scm_supply_items"("supplierItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supply_items_productId_idx" ON "scm_supply_items"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_supply_items_productionOrderItemId_idx" ON "scm_supply_items"("productionOrderItemId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "production_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;




