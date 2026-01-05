-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'COMPONENT_SUPPLIER', 'PACKAGING_SUPPLIER', 'PRINTING_HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'POTENTIAL');

-- CreateEnum
CREATE TYPE "SupplierRole" AS ENUM ('PRODUCER', 'RAW_MATERIAL', 'PACKAGING', 'PRINTING', 'LOGISTICS', 'OTHER');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "countryId" TEXT,
    "suppliesWhat" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "legalName" TEXT,
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "legalAddress" TEXT,
    "bankDetails" JSONB,
    "tags" TEXT[],
    "notes" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_product_suppliers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scmProductId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "role" "SupplierRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "minOrderQty" INTEGER,
    "purchaseCurrency" TEXT,
    "purchasePrice" DECIMAL(14,4),
    "notes" TEXT,

    CONSTRAINT "scm_product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_legal_profiles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "inn" TEXT,
    "kpp" TEXT,
    "ogrn" TEXT,
    "legalAddress" TEXT,
    "actualAddress" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "bankBic" TEXT,
    "bankCorrAccount" TEXT,
    "edoType" TEXT,
    "edoNumber" TEXT,
    "generalDirector" TEXT,

    CONSTRAINT "supplier_legal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_countryId_idx" ON "suppliers"("countryId");

-- CreateIndex
CREATE INDEX "suppliers_type_idx" ON "suppliers"("type");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "scm_product_suppliers_scmProductId_idx" ON "scm_product_suppliers"("scmProductId");

-- CreateIndex
CREATE INDEX "scm_product_suppliers_supplierId_idx" ON "scm_product_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_product_suppliers_scmProductId_supplierId_role_key" ON "scm_product_suppliers"("scmProductId", "supplierId", "role");

-- CreateIndex
CREATE INDEX "supplier_legal_profiles_supplierId_idx" ON "supplier_legal_profiles"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_legal_profiles_countryCode_idx" ON "supplier_legal_profiles"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_legal_profiles_supplierId_countryCode_key" ON "supplier_legal_profiles"("supplierId", "countryCode");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_product_suppliers" ADD CONSTRAINT "scm_product_suppliers_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_product_suppliers" ADD CONSTRAINT "scm_product_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_legal_profiles" ADD CONSTRAINT "supplier_legal_profiles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
