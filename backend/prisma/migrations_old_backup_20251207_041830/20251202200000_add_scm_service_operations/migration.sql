-- CreateEnum: ScmServiceCategory
DO $$ BEGIN
    CREATE TYPE "ScmServiceCategory" AS ENUM ('MANUFACTURING', 'LABELING', 'PACKAGING', 'LOGISTICS_INBOUND', 'LOGISTICS_OUTBOUND', 'STORAGE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: scm_service_operations
CREATE TABLE IF NOT EXISTS "scm_service_operations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "category" "ScmServiceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "supplyId" TEXT,
    "quantity" DECIMAL(14,4),
    "unit" TEXT,
    "pricePerUnit" DECIMAL(14,4),
    "totalAmount" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "financialDocumentId" TEXT,
    "comment" TEXT,

    CONSTRAINT "scm_service_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_service_operations_supplierId_idx" ON "scm_service_operations"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_service_operations_productionOrderId_idx" ON "scm_service_operations"("productionOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_service_operations_supplyId_idx" ON "scm_service_operations"("supplyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_service_operations_financialDocumentId_idx" ON "scm_service_operations"("financialDocumentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scm_service_operations_category_idx" ON "scm_service_operations"("category");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_financialDocumentId_fkey" FOREIGN KEY ("financialDocumentId") REFERENCES "financial_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

