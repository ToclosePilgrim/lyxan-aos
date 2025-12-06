-- CreateTable: scm_stocks
CREATE TABLE IF NOT EXISTS "scm_stocks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "scmProductId" TEXT,
    "supplierItemId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "scm_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: scm_bom_items
CREATE TABLE IF NOT EXISTS "scm_bom_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastagePercent" DECIMAL(5,2),
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "scm_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "scm_stocks_warehouseId_scmProductId_supplierItemId_key" ON "scm_stocks"("warehouseId", "scmProductId", "supplierItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_stocks_warehouseId_idx" ON "scm_stocks"("warehouseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_stocks_scmProductId_idx" ON "scm_stocks"("scmProductId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_stocks_supplierItemId_idx" ON "scm_stocks"("supplierItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_bom_items_productId_idx" ON "scm_bom_items"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_bom_items_supplierItemId_idx" ON "scm_bom_items"("supplierItemId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_bom_items" ADD CONSTRAINT "scm_bom_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_bom_items" ADD CONSTRAINT "scm_bom_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;




