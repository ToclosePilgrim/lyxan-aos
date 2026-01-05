-- CreateEnum
CREATE TYPE "ScmTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementDocType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "MovementDocType" ADD VALUE 'TRANSFER_IN';

-- CreateTable
CREATE TABLE "scm_transfers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ScmTransferStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "scm_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_transfer_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transferId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "receivedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "scm_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_transfers_fromWarehouseId_idx" ON "scm_transfers"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "scm_transfers_toWarehouseId_idx" ON "scm_transfers"("toWarehouseId");

-- CreateIndex
CREATE INDEX "scm_transfers_status_idx" ON "scm_transfers"("status");

-- CreateIndex
CREATE INDEX "scm_transfer_items_transferId_idx" ON "scm_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "scm_transfer_items_supplierItemId_idx" ON "scm_transfer_items"("supplierItemId");

-- AddForeignKey
ALTER TABLE "scm_transfers" ADD CONSTRAINT "scm_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_transfers" ADD CONSTRAINT "scm_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_transfer_items" ADD CONSTRAINT "scm_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "scm_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_transfer_items" ADD CONSTRAINT "scm_transfer_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
