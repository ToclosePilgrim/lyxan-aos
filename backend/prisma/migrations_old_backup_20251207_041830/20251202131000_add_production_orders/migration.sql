-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderItemStatus" AS ENUM ('PLANNED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'USED_IN_PRODUCTION', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "SupplierItemType" AS ENUM ('MATERIAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "SupplierItemCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'LABEL', 'BOX', 'SHIPPING_BOX', 'OTHER');

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityPlanned" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "productionSite" TEXT,
    "notes" TEXT,
    "productionCountryId" TEXT,
    "manufacturerId" TEXT,
    "warehouseId" TEXT,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SupplierItemType" NOT NULL,
    "category" "SupplierItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "specifications" JSONB,
    "notes" TEXT,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "quantityPlanned" DECIMAL(14,4) NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "quantityReceived" DECIMAL(14,4),
    "status" "ProductionOrderItemStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "fromBom" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_productId_idx" ON "production_orders"("productId");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_code_idx" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_productionCountryId_idx" ON "production_orders"("productionCountryId");

-- CreateIndex
CREATE INDEX "production_orders_manufacturerId_idx" ON "production_orders"("manufacturerId");

-- CreateIndex
CREATE INDEX "production_order_items_productionOrderId_idx" ON "production_order_items"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_order_items_supplierItemId_idx" ON "production_order_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "production_order_items_status_idx" ON "production_order_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_code_key" ON "supplier_items"("code");

-- CreateIndex
CREATE INDEX "supplier_items_supplierId_idx" ON "supplier_items"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_items_type_idx" ON "supplier_items"("type");

-- CreateIndex
CREATE INDEX "supplier_items_category_idx" ON "supplier_items"("category");

-- CreateIndex
CREATE INDEX "supplier_items_isActive_idx" ON "supplier_items"("isActive");

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "scm_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productionCountryId_fkey" FOREIGN KEY ("productionCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- Note: warehouseId foreign key will be added later when warehouses table is created

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

