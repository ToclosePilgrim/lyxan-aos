-- AlterTable
ALTER TABLE "products" ADD COLUMN     "aiContentEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contentAttributes" JSONB,
ADD COLUMN     "mpDescription" TEXT,
ADD COLUMN     "mpShortDescription" TEXT,
ADD COLUMN     "mpSubtitle" TEXT,
ADD COLUMN     "mpTitle" TEXT;
