-- AlterTable
ALTER TABLE "products" ADD COLUMN     "contentMeta" JSONB,
ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "title" TEXT;
