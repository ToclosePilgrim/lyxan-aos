-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('MARKETPLACE_INTEGRATION', 'AGENT_RUN');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'COMPONENT_SUPPLIER', 'PACKAGING_SUPPLIER', 'PRINTING_HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'POTENTIAL');

-- CreateEnum
CREATE TYPE "SupplierRole" AS ENUM ('PRODUCER', 'RAW_MATERIAL', 'PACKAGING', 'PRINTING', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierItemType" AS ENUM ('MATERIAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "SupplierItemCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'LABEL', 'BOX', 'SHIPPING_BOX', 'PRINTING', 'MANUFACTURING', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "ScmProductType" AS ENUM ('MANUFACTURED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOrderItemStatus" AS ENUM ('PLANNED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'USED_IN_PRODUCTION', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('OWN', 'MANUFACTURER', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ScmSupplyStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScmServiceCategory" AS ENUM ('MANUFACTURING', 'LABELING', 'PACKAGING', 'LOGISTICS_INBOUND', 'LOGISTICS_OUTBOUND', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialDocumentType" AS ENUM ('INVOICE', 'BILL', 'ACT', 'CREDIT_NOTE', 'OTHER', 'SUPPLY', 'PRODUCTION', 'PURCHASE', 'EXPENSE', 'SUPPLY_INVOICE', 'PRODUCTION_INVOICE', 'SERVICE_INVOICE');

-- CreateEnum
CREATE TYPE "FinancialDocumentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "FinancialDocumentStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'ISSUED');

-- CreateEnum
CREATE TYPE "InventoryDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "SupplierServiceCategory" AS ENUM ('PRODUCTION', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingVersionSource" AS ENUM ('MANUAL', 'AI_AGENT', 'IMPORT');

-- CreateEnum
CREATE TYPE "ContentChangeSource" AS ENUM ('MANUAL', 'AI', 'SYSTEM');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "toneOfVoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "inn" TEXT,
    "kpp" TEXT,
    "ogrn" TEXT,
    "legalAddr" TEXT,
    "bankName" TEXT,
    "bik" TEXT,
    "account" TEXT,
    "corrAccount" TEXT,
    "director" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_countries" (
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "legalEntityId" TEXT,

    CONSTRAINT "brand_countries_pkey" PRIMARY KEY ("brandId","countryId")
);

-- CreateTable
CREATE TABLE "marketplaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_countries" (
    "marketplaceId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "marketplace_countries_pkey" PRIMARY KEY ("marketplaceId","countryId")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

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
    "netWeightGrams" INTEGER,
    "grossWeightGrams" INTEGER,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "barcode" TEXT,
    "countryOfOriginCode" TEXT,
    "technicalAttributes" JSONB,
    "type" "ScmProductType" NOT NULL DEFAULT 'PURCHASED',

    CONSTRAINT "scm_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scmProductId" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "keywords" TEXT,
    "contentMeta" JSONB,
    "mpTitle" TEXT,
    "mpSubtitle" TEXT,
    "mpShortDescription" TEXT,
    "mpDescription" TEXT,
    "contentAttributes" JSONB,
    "aiContentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "netWeightGrams" INTEGER,
    "grossWeightGrams" INTEGER,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "barcode" TEXT,
    "countryOfOriginCode" TEXT,
    "technicalAttributes" JSONB,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "price" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_items" (
    "id" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cards" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "attributes" JSONB,
    "images" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_reports" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "refunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_stats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "spend" DOUBLE PRECISION,
    "orders" INTEGER,
    "revenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "skuId" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scenarios" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT,
    "agentKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "ozonSellerClientId" TEXT,
    "ozonSellerToken" TEXT,
    "ozonPerfClientId" TEXT,
    "ozonPerfClientSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL,
    "source" "LogSource" NOT NULL,
    "message" TEXT NOT NULL,
    "integrationId" TEXT,
    "agentRunId" TEXT,
    "details" JSONB,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "types" "SupplierType"[] DEFAULT ARRAY[]::"SupplierType"[],
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
    "bankAccount" TEXT,
    "corrAccount" TEXT,
    "bik" TEXT,
    "bankName" TEXT,
    "extraPaymentDetails" TEXT,
    "edoSystem" TEXT,
    "edoNumber" TEXT,
    "ceoFullName" TEXT,
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
    "bankExtraDetails" TEXT,
    "edoType" TEXT,
    "edoNumber" TEXT,
    "generalDirector" TEXT,

    CONSTRAINT "supplier_legal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SupplierItemType" NOT NULL,
    "category" "SupplierItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "notes" TEXT,
    "sku" TEXT,
    "currency" TEXT,
    "price" DECIMAL(14,4),
    "minOrderQty" DECIMAL(14,4),
    "leadTimeDays" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_bom_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastagePercent" DECIMAL(5,2),
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "scm_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityPlanned" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "productionSite" TEXT,
    "notes" TEXT,
    "productionCountryId" TEXT,
    "manufacturerId" TEXT,
    "warehouseId" TEXT,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "quantityPlanned" DECIMAL(14,4) NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "quantityReceived" DECIMAL(14,4),
    "status" "ProductionOrderItemStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "fromBom" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'OWN',
    "countryId" TEXT,
    "city" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_stocks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "scmProductId" TEXT,
    "supplierItemId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "scm_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_supplies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ScmSupplyStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "totalAmount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "orderDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "scm_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_supply_items" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplyId" TEXT NOT NULL,
    "supplierItemId" TEXT,
    "productId" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "pricePerUnit" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "productionOrderItemId" TEXT,

    CONSTRAINT "scm_supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT,
    "supplierItemId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT,
    "supplierItemId" TEXT,
    "supplyId" TEXT,
    "supplyItemId" TEXT,
    "direction" "InventoryDirection" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_service_operations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "category" "ScmServiceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "supplyId" TEXT,
    "quantity" DECIMAL(14,4),
    "unit" TEXT,
    "pricePerUnit" DECIMAL(14,4),
    "totalAmount" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "financialDocumentId" TEXT,
    "comment" TEXT,

    CONSTRAINT "scm_service_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_services" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" "SupplierServiceCategory" NOT NULL DEFAULT 'OTHER',
    "unit" TEXT NOT NULL,
    "basePrice" DECIMAL(14,4),
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "supplier_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "docNumber" TEXT,
    "docDate" TIMESTAMP(3),
    "type" "FinancialDocumentType",
    "direction" "FinancialDocumentDirection",
    "status" "FinancialDocumentStatus" DEFAULT 'DRAFT',
    "currency" TEXT,
    "amountTotal" DECIMAL(14,4),
    "amountPaid" DECIMAL(14,4),
    "dueDate" TIMESTAMP(3),
    "supplierId" TEXT,
    "productionOrderId" TEXT,
    "scmSupplyId" TEXT,
    "purchaseId" TEXT,
    "expenseId" TEXT,
    "externalId" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "number" TEXT,
    "date" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_content_versions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "source" "ListingVersionSource" NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "createdByUserId" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "keywords" TEXT,
    "contentMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_content_versions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplaceCode" TEXT,
    "versionNumber" INTEGER NOT NULL,
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
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- CreateIndex
CREATE INDEX "legal_entities_countryId_idx" ON "legal_entities"("countryId");

-- CreateIndex
CREATE INDEX "brand_countries_brandId_idx" ON "brand_countries"("brandId");

-- CreateIndex
CREATE INDEX "brand_countries_countryId_idx" ON "brand_countries"("countryId");

-- CreateIndex
CREATE INDEX "brand_countries_legalEntityId_idx" ON "brand_countries"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplaces_code_key" ON "marketplaces"("code");

-- CreateIndex
CREATE INDEX "marketplace_countries_marketplaceId_idx" ON "marketplace_countries"("marketplaceId");

-- CreateIndex
CREATE INDEX "marketplace_countries_countryId_idx" ON "marketplace_countries"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "scm_products_brandId_idx" ON "scm_products"("brandId");

-- CreateIndex
CREATE INDEX "scm_products_sku_idx" ON "scm_products"("sku");

-- CreateIndex
CREATE INDEX "scm_products_type_idx" ON "scm_products"("type");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_marketplaceId_idx" ON "products"("marketplaceId");

-- CreateIndex
CREATE INDEX "products_scmProductId_idx" ON "products"("scmProductId");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE INDEX "skus_productId_idx" ON "skus"("productId");

-- CreateIndex
CREATE INDEX "skus_code_idx" ON "skus"("code");

-- CreateIndex
CREATE INDEX "stocks_skuId_idx" ON "stocks"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_skuId_key" ON "stocks"("skuId");

-- CreateIndex
CREATE INDEX "supplies_status_idx" ON "supplies"("status");

-- CreateIndex
CREATE INDEX "supply_items_supplyId_idx" ON "supply_items"("supplyId");

-- CreateIndex
CREATE INDEX "supply_items_skuId_idx" ON "supply_items"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "product_cards_productId_key" ON "product_cards"("productId");

-- CreateIndex
CREATE INDEX "product_cards_productId_idx" ON "product_cards"("productId");

-- CreateIndex
CREATE INDEX "finance_reports_date_idx" ON "finance_reports"("date");

-- CreateIndex
CREATE INDEX "finance_reports_skuId_idx" ON "finance_reports"("skuId");

-- CreateIndex
CREATE INDEX "finance_reports_skuId_date_idx" ON "finance_reports"("skuId", "date");

-- CreateIndex
CREATE INDEX "ad_campaigns_marketplaceId_idx" ON "ad_campaigns"("marketplaceId");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex
CREATE INDEX "ad_stats_campaignId_idx" ON "ad_stats"("campaignId");

-- CreateIndex
CREATE INDEX "ad_stats_date_idx" ON "ad_stats"("date");

-- CreateIndex
CREATE INDEX "ad_stats_campaignId_date_idx" ON "ad_stats"("campaignId", "date");

-- CreateIndex
CREATE INDEX "reviews_skuId_idx" ON "reviews"("skuId");

-- CreateIndex
CREATE INDEX "reviews_date_idx" ON "reviews"("date");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_scenarios_key_key" ON "agent_scenarios"("key");

-- CreateIndex
CREATE INDEX "agent_scenarios_key_idx" ON "agent_scenarios"("key");

-- CreateIndex
CREATE INDEX "agent_runs_agentKey_idx" ON "agent_runs"("agentKey");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_runs_scenarioId_idx" ON "agent_runs"("scenarioId");

-- CreateIndex
CREATE INDEX "agent_runs_startedAt_idx" ON "agent_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_key_key" ON "integrations"("key");

-- CreateIndex
CREATE INDEX "integrations_key_idx" ON "integrations"("key");

-- CreateIndex
CREATE INDEX "marketplace_integrations_marketplaceId_idx" ON "marketplace_integrations"("marketplaceId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_brandId_idx" ON "marketplace_integrations"("brandId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_countryId_idx" ON "marketplace_integrations"("countryId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_status_idx" ON "marketplace_integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_integrations_marketplaceId_brandId_countryId_key" ON "marketplace_integrations"("marketplaceId", "brandId", "countryId");

-- CreateIndex
CREATE INDEX "integration_logs_integrationId_idx" ON "integration_logs"("integrationId");

-- CreateIndex
CREATE INDEX "integration_logs_agentRunId_idx" ON "integration_logs"("agentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_countryId_idx" ON "suppliers"("countryId");

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

-- CreateIndex
CREATE INDEX "supplier_items_supplierId_idx" ON "supplier_items"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_items_type_idx" ON "supplier_items"("type");

-- CreateIndex
CREATE INDEX "supplier_items_category_idx" ON "supplier_items"("category");

-- CreateIndex
CREATE INDEX "supplier_items_isActive_idx" ON "supplier_items"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_supplierId_code_key" ON "supplier_items"("supplierId", "code");

-- CreateIndex
CREATE INDEX "scm_bom_items_productId_idx" ON "scm_bom_items"("productId");

-- CreateIndex
CREATE INDEX "scm_bom_items_supplierItemId_idx" ON "scm_bom_items"("supplierItemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_productId_idx" ON "production_orders"("productId");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_code_idx" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_order_items_productionOrderId_idx" ON "production_order_items"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_order_items_supplierItemId_idx" ON "production_order_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "production_order_items_status_idx" ON "production_order_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_countryId_idx" ON "warehouses"("countryId");

-- CreateIndex
CREATE INDEX "warehouses_isActive_idx" ON "warehouses"("isActive");

-- CreateIndex
CREATE INDEX "warehouses_type_idx" ON "warehouses"("type");

-- CreateIndex
CREATE INDEX "scm_stocks_warehouseId_idx" ON "scm_stocks"("warehouseId");

-- CreateIndex
CREATE INDEX "scm_stocks_scmProductId_idx" ON "scm_stocks"("scmProductId");

-- CreateIndex
CREATE INDEX "scm_stocks_supplierItemId_idx" ON "scm_stocks"("supplierItemId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_stocks_warehouseId_scmProductId_supplierItemId_key" ON "scm_stocks"("warehouseId", "scmProductId", "supplierItemId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_supplies_code_key" ON "scm_supplies"("code");

-- CreateIndex
CREATE INDEX "scm_supplies_supplierId_idx" ON "scm_supplies"("supplierId");

-- CreateIndex
CREATE INDEX "scm_supplies_warehouseId_idx" ON "scm_supplies"("warehouseId");

-- CreateIndex
CREATE INDEX "scm_supplies_productionOrderId_idx" ON "scm_supplies"("productionOrderId");

-- CreateIndex
CREATE INDEX "scm_supplies_status_idx" ON "scm_supplies"("status");

-- CreateIndex
CREATE INDEX "scm_supplies_code_idx" ON "scm_supplies"("code");

-- CreateIndex
CREATE INDEX "scm_supply_items_supplyId_idx" ON "scm_supply_items"("supplyId");

-- CreateIndex
CREATE INDEX "scm_supply_items_supplierItemId_idx" ON "scm_supply_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "scm_supply_items_productId_idx" ON "scm_supply_items"("productId");

-- CreateIndex
CREATE INDEX "scm_supply_items_productionOrderItemId_idx" ON "scm_supply_items"("productionOrderItemId");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouseId_idx" ON "inventory_balances"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_balances_productId_idx" ON "inventory_balances"("productId");

-- CreateIndex
CREATE INDEX "inventory_balances_supplierItemId_idx" ON "inventory_balances"("supplierItemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouseId_productId_supplierItemId_key" ON "inventory_balances"("warehouseId", "productId", "supplierItemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_warehouseId_idx" ON "inventory_transactions"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_transactions_productId_idx" ON "inventory_transactions"("productId");

-- CreateIndex
CREATE INDEX "inventory_transactions_supplierItemId_idx" ON "inventory_transactions"("supplierItemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_supplyId_idx" ON "inventory_transactions"("supplyId");

-- CreateIndex
CREATE INDEX "inventory_transactions_supplyItemId_idx" ON "inventory_transactions"("supplyItemId");

-- CreateIndex
CREATE INDEX "scm_service_operations_supplierId_idx" ON "scm_service_operations"("supplierId");

-- CreateIndex
CREATE INDEX "scm_service_operations_productionOrderId_idx" ON "scm_service_operations"("productionOrderId");

-- CreateIndex
CREATE INDEX "scm_service_operations_supplyId_idx" ON "scm_service_operations"("supplyId");

-- CreateIndex
CREATE INDEX "scm_service_operations_financialDocumentId_idx" ON "scm_service_operations"("financialDocumentId");

-- CreateIndex
CREATE INDEX "scm_service_operations_category_idx" ON "scm_service_operations"("category");

-- CreateIndex
CREATE INDEX "supplier_services_supplierId_idx" ON "supplier_services"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_services_category_idx" ON "supplier_services"("category");

-- CreateIndex
CREATE INDEX "supplier_services_isActive_idx" ON "supplier_services"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_services_supplierId_code_key" ON "supplier_services"("supplierId", "code");

-- CreateIndex
CREATE INDEX "financial_documents_supplierId_idx" ON "financial_documents"("supplierId");

-- CreateIndex
CREATE INDEX "financial_documents_productionOrderId_idx" ON "financial_documents"("productionOrderId");

-- CreateIndex
CREATE INDEX "financial_documents_scmSupplyId_idx" ON "financial_documents"("scmSupplyId");

-- CreateIndex
CREATE INDEX "financial_documents_purchaseId_idx" ON "financial_documents"("purchaseId");

-- CreateIndex
CREATE INDEX "financial_documents_expenseId_idx" ON "financial_documents"("expenseId");

-- CreateIndex
CREATE INDEX "financial_documents_status_idx" ON "financial_documents"("status");

-- CreateIndex
CREATE INDEX "financial_documents_docNumber_idx" ON "financial_documents"("docNumber");

-- CreateIndex
CREATE INDEX "financial_documents_number_idx" ON "financial_documents"("number");

-- CreateIndex
CREATE INDEX "listing_content_versions_listingId_versionNumber_idx" ON "listing_content_versions"("listingId", "versionNumber");

-- CreateIndex
CREATE INDEX "listing_content_versions_listingId_idx" ON "listing_content_versions"("listingId");

-- CreateIndex
CREATE INDEX "product_content_versions_productId_idx" ON "product_content_versions"("productId");

-- CreateIndex
CREATE INDEX "product_content_versions_productId_versionNumber_idx" ON "product_content_versions"("productId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "product_content_versions_productId_versionNumber_key" ON "product_content_versions"("productId", "versionNumber");

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_countries" ADD CONSTRAINT "marketplace_countries_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_countries" ADD CONSTRAINT "marketplace_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_products" ADD CONSTRAINT "scm_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cards" ADD CONSTRAINT "product_cards_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reports" ADD CONSTRAINT "finance_reports_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_stats" ADD CONSTRAINT "ad_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "agent_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "marketplace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_product_suppliers" ADD CONSTRAINT "scm_product_suppliers_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_product_suppliers" ADD CONSTRAINT "scm_product_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_legal_profiles" ADD CONSTRAINT "supplier_legal_profiles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_bom_items" ADD CONSTRAINT "scm_bom_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_bom_items" ADD CONSTRAINT "scm_bom_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "scm_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productionCountryId_fkey" FOREIGN KEY ("productionCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_stocks" ADD CONSTRAINT "scm_stocks_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supplies" ADD CONSTRAINT "scm_supplies_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_items" ADD CONSTRAINT "scm_supply_items_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "production_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "scm_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_service_operations" ADD CONSTRAINT "scm_service_operations_financialDocumentId_fkey" FOREIGN KEY ("financialDocumentId") REFERENCES "financial_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_services" ADD CONSTRAINT "supplier_services_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_scmSupplyId_fkey" FOREIGN KEY ("scmSupplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_content_versions" ADD CONSTRAINT "product_content_versions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_content_versions" ADD CONSTRAINT "product_content_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
