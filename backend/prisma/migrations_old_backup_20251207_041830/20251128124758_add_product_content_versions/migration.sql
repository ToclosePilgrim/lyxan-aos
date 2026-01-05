-- CreateEnum
CREATE TYPE "ContentChangeSource" AS ENUM ('MANUAL', 'AI', 'SYSTEM');

-- CreateTable
CREATE TABLE "product_content_versions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplaceCode" TEXT,
    "mpTitle" TEXT,
    "mpSubtitle" TEXT,
    "mpShortDescription" TEXT,
    "mpDescription" TEXT,
    "keywords" TEXT,
    "contentAttributes" JSONB,
    "source" "ContentChangeSource" NOT NULL DEFAULT 'MANUAL',
    "userId" TEXT,
    "agentLabel" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_content_versions_productId_idx" ON "product_content_versions"("productId");

-- CreateIndex
CREATE INDEX "product_content_versions_productId_createdAt_idx" ON "product_content_versions"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "product_content_versions" ADD CONSTRAINT "product_content_versions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_content_versions" ADD CONSTRAINT "product_content_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
