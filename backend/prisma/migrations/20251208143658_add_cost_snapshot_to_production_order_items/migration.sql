-- AlterTable
ALTER TABLE "production_order_items" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'RUB',
ADD COLUMN     "hasMissingCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plannedTotalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "plannedUnitCost" DECIMAL(14,4) NOT NULL DEFAULT 0;
