-- CreateEnum
CREATE TYPE "ScmProductType" AS ENUM ('MANUFACTURED', 'PURCHASED');

-- AlterTable
ALTER TABLE "scm_products" ADD COLUMN "type" "ScmProductType" NOT NULL DEFAULT 'PURCHASED';

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "bankAccount" TEXT,
ADD COLUMN "corrAccount" TEXT,
ADD COLUMN "bik" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "extraPaymentDetails" TEXT;




