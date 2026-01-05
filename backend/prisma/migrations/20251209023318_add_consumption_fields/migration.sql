-- AlterTable
ALTER TABLE "production_order_items" ADD COLUMN     "consumedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "isConsumed" BOOLEAN NOT NULL DEFAULT false;
