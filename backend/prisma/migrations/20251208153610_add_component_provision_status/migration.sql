-- CreateEnum
CREATE TYPE "ScmComponentProvisionStatus" AS ENUM ('NOT_PLANNED', 'PLANNED', 'IN_PROGRESS', 'RECEIVED');

-- AlterTable
ALTER TABLE "production_order_items" ADD COLUMN     "provisionStatus" "ScmComponentProvisionStatus" NOT NULL DEFAULT 'NOT_PLANNED',
ADD COLUMN     "provisionedQty" DECIMAL(14,4) NOT NULL DEFAULT 0;
