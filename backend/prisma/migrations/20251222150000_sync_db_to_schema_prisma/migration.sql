-- CreateEnum
CREATE TYPE "BcmBrandProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BcmListingProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BcmProductProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "LegalEntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MdmItemType" AS ENUM ('PRODUCT', 'MATERIAL');

-- CreateEnum
CREATE TYPE "SpecProfileStatus" AS ENUM ('DRAFT', 'APPROVED');

-- DropForeignKey
ALTER TABLE "bcm_listing_versions" DROP CONSTRAINT "bcm_listing_versions_listingId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_listings" DROP CONSTRAINT "bcm_listings_brandId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_listings" DROP CONSTRAINT "bcm_listings_countryId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_listings" DROP CONSTRAINT "bcm_listings_marketplaceId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_listings" DROP CONSTRAINT "bcm_listings_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_product_contents" DROP CONSTRAINT "bcm_product_contents_countryId_fkey";

-- DropForeignKey
ALTER TABLE "bcm_product_contents" DROP CONSTRAINT "bcm_product_contents_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_balances" DROP CONSTRAINT "inventory_balances_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_balances" DROP CONSTRAINT "inventory_balances_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "legal_entities" DROP CONSTRAINT "legal_entities_countryId_fkey";

-- DropForeignKey
ALTER TABLE "production_order_items" DROP CONSTRAINT "production_order_items_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "sales_document_lines" DROP CONSTRAINT "sales_document_lines_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "sales_document_lines" DROP CONSTRAINT "sales_document_lines_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "scm_bom_items" DROP CONSTRAINT "scm_bom_items_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "scm_stocks" DROP CONSTRAINT "scm_stocks_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "scm_stocks" DROP CONSTRAINT "scm_stocks_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "scm_supply_items" DROP CONSTRAINT "scm_supply_items_scmProductId_fkey";

-- DropForeignKey
ALTER TABLE "scm_supply_items" DROP CONSTRAINT "scm_supply_items_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "scm_transfer_items" DROP CONSTRAINT "scm_transfer_items_supplierItemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_reservations" DROP CONSTRAINT "stock_reservations_itemId_fkey";

-- DropIndex
DROP INDEX "inventory_balances_scmProductId_idx";

-- DropIndex
DROP INDEX "inventory_balances_supplierItemId_idx";

-- DropIndex
DROP INDEX "inventory_balances_warehouseId_scmProductId_supplierItemId_key";

-- DropIndex
DROP INDEX "inventory_transactions_scmProductId_idx";

-- DropIndex
DROP INDEX "inventory_transactions_supplierItemId_idx";

-- DropIndex
DROP INDEX "legal_entities_countryId_idx";

-- DropIndex
DROP INDEX "production_order_items_supplierItemId_idx";

-- DropIndex
DROP INDEX "sales_document_lines_scmProductId_idx";

-- DropIndex
DROP INDEX "sales_document_lines_supplierItemId_idx";

-- DropIndex
DROP INDEX "scm_bom_items_supplierItemId_idx";

-- DropIndex
DROP INDEX "scm_stocks_scmProductId_idx";

-- DropIndex
DROP INDEX "scm_stocks_supplierItemId_idx";

-- DropIndex
DROP INDEX "scm_stocks_warehouseId_scmProductId_supplierItemId_key";

-- DropIndex
DROP INDEX "scm_supply_items_scmProductId_idx";

-- DropIndex
DROP INDEX "scm_supply_items_supplierItemId_idx";

-- DropIndex
DROP INDEX "scm_supply_receipts_supplyId_idx";

-- DropIndex
DROP INDEX "scm_transfer_items_supplierItemId_idx";

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "description",
DROP COLUMN "toneOfVoice";

-- AlterTable
ALTER TABLE "inventory_balances" DROP COLUMN "scmProductId",
DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "inventory_transactions" DROP COLUMN "scmProductId",
DROP COLUMN "supplierItemId",
ALTER COLUMN "itemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "legal_entities" DROP COLUMN "account",
DROP COLUMN "bankName",
DROP COLUMN "bik",
DROP COLUMN "corrAccount",
DROP COLUMN "countryId",
DROP COLUMN "inn",
DROP COLUMN "legalAddr",
DROP COLUMN "ogrn",
ADD COLUMN     "bankDetails" JSONB,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "countryCode" TEXT NOT NULL,
ADD COLUMN     "legalAddress" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "LegalEntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taxId" TEXT;

-- AlterTable
ALTER TABLE "production_order_items" DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sales_document_lines" DROP COLUMN "scmProductId",
DROP COLUMN "supplierItemId",
ALTER COLUMN "itemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "scm_bom_items" DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "scm_products" DROP COLUMN "barcode",
DROP COLUMN "countryOfOriginCode",
DROP COLUMN "grossWeightGrams",
DROP COLUMN "heightMm",
DROP COLUMN "lengthMm",
DROP COLUMN "netWeightGrams",
DROP COLUMN "technicalAttributes",
DROP COLUMN "widthMm",
ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "scm_stocks" DROP COLUMN "scmProductId",
DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "scm_supply_items" DROP COLUMN "scmProductId",
DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL,
ADD COLUMN     "offerId" TEXT;

-- AlterTable
ALTER TABLE "scm_transfer_items" DROP COLUMN "supplierItemId",
ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "supplier_items" ADD COLUMN     "itemId" TEXT;

-- DropTable
DROP TABLE "bcm_listing_versions";

-- DropTable
DROP TABLE "bcm_listings";

-- DropTable
DROP TABLE "bcm_product_contents";

-- CreateTable
CREATE TABLE "bcm_brand_profiles" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "BcmBrandProfileStatus" NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "toneOfVoice" TEXT,
    "guidelines" TEXT,
    "websiteUrl" TEXT,
    "socialLinks" JSONB,
    "assets" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcm_brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcm_listing_profiles" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "BcmListingProfileStatus" NOT NULL,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "bulletPointsOverride" JSONB,
    "attributes" JSONB,
    "mediaOverride" JSONB,
    "compliance" JSONB,
    "externalListingId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcm_listing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcm_product_profiles" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "brandId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "BcmProductProfileStatus" NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "bulletPoints" JSONB,
    "keyFeatures" JSONB,
    "ingredients" JSONB,
    "usage" TEXT,
    "claims" JSONB,
    "seo" JSONB,
    "media" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcm_product_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparty_offers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendorCode" TEXT,
    "name" TEXT,
    "currencyCode" TEXT NOT NULL,
    "price" DECIMAL(14,4) NOT NULL,
    "minOrderQty" DECIMAL(14,4),
    "leadTimeDays" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "counterparty_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdm_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "MdmItemType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mdm_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_profiles" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" "SpecProfileStatus" NOT NULL,
    "version" INTEGER,
    "facts" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bcm_brand_profiles_brandId_idx" ON "bcm_brand_profiles"("brandId");

-- CreateIndex
CREATE INDEX "bcm_brand_profiles_status_idx" ON "bcm_brand_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_brand_profiles_brandId_locale_status_key" ON "bcm_brand_profiles"("brandId", "locale", "status");

-- CreateIndex
CREATE INDEX "bcm_listing_profiles_itemId_idx" ON "bcm_listing_profiles"("itemId");

-- CreateIndex
CREATE INDEX "bcm_listing_profiles_marketplace_country_idx" ON "bcm_listing_profiles"("marketplaceId", "countryId");

-- CreateIndex
CREATE INDEX "bcm_listing_profiles_status_idx" ON "bcm_listing_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_listing_profiles_itemId_marketplaceId_countryId_locale_stat" ON "bcm_listing_profiles"("itemId", "marketplaceId", "countryId", "locale", "status");

-- CreateIndex
CREATE INDEX "bcm_product_profiles_brandId_idx" ON "bcm_product_profiles"("brandId");

-- CreateIndex
CREATE INDEX "bcm_product_profiles_itemId_idx" ON "bcm_product_profiles"("itemId");

-- CreateIndex
CREATE INDEX "bcm_product_profiles_status_idx" ON "bcm_product_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_product_profiles_itemId_locale_status_key" ON "bcm_product_profiles"("itemId", "locale", "status");

-- CreateIndex
CREATE INDEX "counterparty_offers_counterpartyId_idx" ON "counterparty_offers"("counterpartyId");

-- CreateIndex
CREATE INDEX "counterparty_offers_isActive_idx" ON "counterparty_offers"("isActive");

-- CreateIndex
CREATE INDEX "counterparty_offers_itemId_idx" ON "counterparty_offers"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "counterparty_offers_counterpartyId_itemId_vendorCode_key" ON "counterparty_offers"("counterpartyId", "itemId", "vendorCode");

-- CreateIndex
CREATE INDEX "mdm_items_code_idx" ON "mdm_items"("code");

-- CreateIndex
CREATE INDEX "mdm_items_type_idx" ON "mdm_items"("type");

-- CreateIndex
CREATE UNIQUE INDEX "mdm_items_type_code_key" ON "mdm_items"("type", "code");

-- CreateIndex
CREATE INDEX "spec_profiles_itemId_idx" ON "spec_profiles"("itemId");

-- CreateIndex
CREATE INDEX "spec_profiles_status_idx" ON "spec_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "spec_profiles_itemId_status_key" ON "spec_profiles"("itemId", "status");

-- CreateIndex
CREATE INDEX "inventory_balances_itemId_idx" ON "inventory_balances"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouseId_itemId_key" ON "inventory_balances"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_itemId_idx" ON "inventory_transactions"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_code_key" ON "legal_entities"("code");

-- CreateIndex
CREATE INDEX "production_order_items_itemId_idx" ON "production_order_items"("itemId");

-- CreateIndex
CREATE INDEX "scm_bom_items_itemId_idx" ON "scm_bom_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_products_itemId_key" ON "scm_products"("itemId");

-- CreateIndex
CREATE INDEX "scm_stocks_itemId_idx" ON "scm_stocks"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_stocks_warehouseId_itemId_key" ON "scm_stocks"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "scm_supply_items_itemId_idx" ON "scm_supply_items"("itemId");

-- CreateIndex
CREATE INDEX "scm_supply_items_offerId_idx" ON "scm_supply_items"("offerId");

-- CreateIndex
CREATE INDEX "scm_transfer_items_itemId_idx" ON "scm_transfer_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_itemId_key" ON "supplier_items"("itemId");

-- RenameForeignKey
ALTER TABLE "scm_supply_receipt_lines" RENAME CONSTRAINT "scm_supply_receipts_supplyItemId_fkey" TO "scm_supply_receipt_lines_supplyItemId_fkey";

-- AddForeignKey
ALTER TABLE "bcm_brand_profiles" ADD CONSTRAINT "bcm_brand_profiles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listing_profiles" ADD CONSTRAINT "bcm_listing_profiles_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listing_profiles" ADD CONSTRAINT "bcm_listing_profiles_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listing_profiles" ADD CONSTRAINT "bcm_listing_profiles_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_product_profiles" ADD CONSTRAINT "bcm_product_profiles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_product_profiles" ADD CONSTRAINT "bcm_product_profiles_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparty_offers" ADD CONSTRAINT "counterparty_offers_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparty_offers" ADD CONSTRAINT "counterparty_offers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_rules" ADD CONSTRAINT "overhead_allocation_rules_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_bom_items" ADD CONSTRAINT "scm_bom_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_products" ADD CONSTRAINT "scm_products_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "counterparty_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_transfer_items" ADD CONSTRAINT "scm_transfer_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_profiles" ADD CONSTRAINT "spec_profiles_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_profiles" ADD CONSTRAINT "spec_profiles_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

