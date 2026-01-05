-- AlterTable
ALTER TABLE "products" ADD COLUMN     "scmProductId" TEXT;

-- CreateTable
CREATE TABLE "scm_products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "internalName" TEXT NOT NULL,
    "sku" TEXT,
    "brandId" TEXT,
    "baseDescription" TEXT,
    "composition" TEXT,

    CONSTRAINT "scm_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_products_brandId_idx" ON "scm_products"("brandId");

-- CreateIndex
CREATE INDEX "scm_products_sku_idx" ON "scm_products"("sku");

-- CreateIndex
CREATE INDEX "products_scmProductId_idx" ON "products"("scmProductId");

-- AddForeignKey
ALTER TABLE "scm_products" ADD CONSTRAINT "scm_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
