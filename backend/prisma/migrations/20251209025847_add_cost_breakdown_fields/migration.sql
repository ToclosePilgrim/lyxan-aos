-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN     "totalMaterialCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "totalServiceCost" DECIMAL(14,4) NOT NULL DEFAULT 0;
