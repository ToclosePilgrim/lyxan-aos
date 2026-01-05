-- AlterTable
ALTER TABLE "scm_service_operations" ADD COLUMN     "supplierServiceId" TEXT;

-- CreateIndex
CREATE INDEX "scm_service_operations_supplierServiceId_idx" ON "scm_service_operations"("supplierServiceId");

-- AddForeignKey
ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_supplierServiceId_fkey" FOREIGN KEY ("supplierServiceId") REFERENCES "supplier_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
