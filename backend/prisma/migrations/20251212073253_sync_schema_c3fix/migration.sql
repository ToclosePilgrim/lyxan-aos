-- CreateEnum
CREATE TYPE "ProductionConsumptionStatus" AS ENUM ('NOT_CONSUMED', 'PARTIALLY_CONSUMED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockReservationForType" AS ENUM ('PRODUCTION_ORDER', 'SALES_ORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "OverheadAllocationMethod" AS ENUM ('PER_UNIT', 'PER_ORDER', 'PERCENT_OF_MATERIAL_COST');

-- CreateEnum
CREATE TYPE "OverheadScope" AS ENUM ('GLOBAL', 'BRAND', 'COUNTRY', 'ITEM', 'CATEGORY', 'SUPPLY', 'PRODUCTION_ORDER');

-- CreateEnum
CREATE TYPE "AccountingDocType" AS ENUM ('SUPPLY_RECEIPT', 'PRODUCTION_COMPLETION', 'FINANCIAL_DOCUMENT', 'PAYMENT', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'SALES_DOCUMENT', 'SUPPLY', 'INVENTORY_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OsEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SalesDocumentStatus" AS ENUM ('DRAFT', 'IMPORTED', 'VALIDATED', 'POSTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "FinanceLinkedDocType" ADD VALUE 'SALES_DOCUMENT';

-- AlterEnum
ALTER TYPE "FinancialDocumentType" ADD VALUE 'SALES';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementDocType" ADD VALUE 'STOCK_ADJUSTMENT';
ALTER TYPE "MovementDocType" ADD VALUE 'SCRAP';
ALTER TYPE "MovementDocType" ADD VALUE 'LOSS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'SCRAP';
ALTER TYPE "MovementType" ADD VALUE 'LOSS';
ALTER TYPE "MovementType" ADD VALUE 'ADJUSTMENT';

-- AlterEnum
ALTER TYPE "ScmSupplyStatus" ADD VALUE 'CLOSED';

-- AlterEnum
BEGIN;
CREATE TYPE "ScmTransferStatus_new" AS ENUM ('DRAFT', 'REQUESTED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED');
ALTER TABLE "public"."scm_transfers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "scm_transfers" ALTER COLUMN "status" TYPE "ScmTransferStatus_new" USING ("status"::text::"ScmTransferStatus_new");
ALTER TYPE "ScmTransferStatus" RENAME TO "ScmTransferStatus_old";
ALTER TYPE "ScmTransferStatus_new" RENAME TO "ScmTransferStatus";
DROP TYPE "public"."ScmTransferStatus_old";
ALTER TABLE "scm_transfers" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "finance_reports" ADD COLUMN     "sales_document_id" TEXT,
ADD COLUMN     "sales_document_line_id" TEXT;

-- AlterTable
ALTER TABLE "financial_documents" ADD COLUMN     "amountPaidBase" DECIMAL(18,2),
ADD COLUMN     "amountTotalBase" DECIMAL(18,2),
ADD COLUMN     "isAutoCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceDocId" TEXT,
ADD COLUMN     "sourceDocType" "AccountingDocType";

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "docId" TEXT,
ADD COLUMN     "docType" TEXT,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "stockMovementId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "production_order_items" ADD COLUMN     "consumptionStatus" "ProductionConsumptionStatus" NOT NULL DEFAULT 'NOT_CONSUMED';

-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN     "overheadCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "totalCostBase" DECIMAL(14,4),
ADD COLUMN     "unitCostBase" DECIMAL(14,6);

-- AlterTable
ALTER TABLE "scm_supply_items" ADD COLUMN     "customsCost" DECIMAL(18,4),
ADD COLUMN     "inboundCost" DECIMAL(18,4),
ADD COLUMN     "logisticsCost" DECIMAL(18,4),
ADD COLUMN     "remainingQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN     "baseUnitCost" DECIMAL(18,4),
ADD COLUMN     "customsUnitCost" DECIMAL(18,4),
ADD COLUMN     "inboundUnitCost" DECIMAL(18,4),
ADD COLUMN     "logisticsUnitCost" DECIMAL(18,4),
ADD COLUMN     "unitCostBase" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "consumptionOperationId" TEXT,
ADD COLUMN     "inventoryTransactionId" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "productionBatchId" TEXT,
ADD COLUMN     "sourceDocId" TEXT,
ADD COLUMN     "sourceDocType" "AccountingDocType";

-- CreateTable
CREATE TABLE "sales_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "countryId" TEXT,
    "brandId" TEXT,
    "marketplaceId" TEXT,
    "warehouseId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "externalId" TEXT,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "status" "SalesDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "totalCogs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financialDocumentId" TEXT,

    CONSTRAINT "sales_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_document_lines" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "salesDocumentId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "skuId" TEXT,
    "productId" TEXT,
    "scmProductId" TEXT,
    "supplierItemId" TEXT,
    "itemId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "revenue" DECIMAL(18,2) NOT NULL,
    "commission" DECIMAL(18,2) NOT NULL,
    "refunds" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cogsAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "sales_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_consumption_operations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionOrderId" TEXT NOT NULL,
    "productionOrderItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "responsibleUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "production_consumption_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "totalQty" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scm_supply_receipts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "pricePerUnit" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "scm_supply_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_allocation_rules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" "OverheadAllocationMethod" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "currency" TEXT,
    "scope" "OverheadScope" NOT NULL,
    "brandId" TEXT,
    "countryId" TEXT,
    "itemId" TEXT,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "overhead_allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rateToBase" DECIMAL(18,6) NOT NULL,
    "source" TEXT,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "docType" "AccountingDocType" NOT NULL,
    "docId" TEXT NOT NULL,
    "sourceDocType" "AccountingDocType",
    "sourceDocId" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "amountBase" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "countryId" TEXT,
    "brandId" TEXT,
    "marketplaceId" TEXT,
    "warehouseId" TEXT,

    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_accounting_links" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockMovementId" TEXT NOT NULL,
    "accountingEntryId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "inventory_accounting_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "OsEventStatus" NOT NULL DEFAULT 'PENDING',
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "payload" JSONB NOT NULL,
    "source" TEXT,

    CONSTRAINT "os_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_domain_objects" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityName" TEXT,
    "serviceKey" TEXT,
    "apiBasePath" TEXT,
    "primaryKey" TEXT NOT NULL DEFAULT 'id',
    "idPayloadKey" TEXT DEFAULT 'id',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "statusEntityName" TEXT,
    "statusFieldName" TEXT,
    "statusesDefinition" JSONB,

    CONSTRAINT "os_domain_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_domain_actions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "objectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "handlerName" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "httpMethod" TEXT,
    "httpPath" TEXT,
    "isPostingAction" BOOLEAN NOT NULL DEFAULT false,
    "allowedFromStatuses" TEXT,
    "targetStatus" TEXT,
    "isBulk" BOOLEAN NOT NULL DEFAULT false,
    "enabledForAgents" BOOLEAN NOT NULL DEFAULT true,
    "requiredRole" TEXT,
    "requestSchema" JSONB,
    "responseSchema" JSONB,
    "allowWhenNoStatus" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "os_domain_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_lifecycles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "objectId" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'DEFAULT',
    "definition" JSONB NOT NULL,

    CONSTRAINT "os_lifecycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "reservedForType" "StockReservationForType" NOT NULL,
    "reservedForId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'POSTED',
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "currency" TEXT DEFAULT 'RUB',
    "reason" TEXT,
    "meta" JSONB,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_documents_periodFrom_idx" ON "sales_documents"("periodFrom");

-- CreateIndex
CREATE INDEX "sales_documents_periodTo_idx" ON "sales_documents"("periodTo");

-- CreateIndex
CREATE INDEX "sales_documents_status_idx" ON "sales_documents"("status");

-- CreateIndex
CREATE INDEX "sales_documents_brandId_idx" ON "sales_documents"("brandId");

-- CreateIndex
CREATE INDEX "sales_documents_marketplaceId_idx" ON "sales_documents"("marketplaceId");

-- CreateIndex
CREATE INDEX "sales_documents_warehouseId_idx" ON "sales_documents"("warehouseId");

-- CreateIndex
CREATE INDEX "sales_documents_financialDocumentId_idx" ON "sales_documents"("financialDocumentId");

-- CreateIndex
CREATE INDEX "sales_document_lines_salesDocumentId_idx" ON "sales_document_lines"("salesDocumentId");

-- CreateIndex
CREATE INDEX "sales_document_lines_warehouseId_idx" ON "sales_document_lines"("warehouseId");

-- CreateIndex
CREATE INDEX "sales_document_lines_skuId_idx" ON "sales_document_lines"("skuId");

-- CreateIndex
CREATE INDEX "sales_document_lines_productId_idx" ON "sales_document_lines"("productId");

-- CreateIndex
CREATE INDEX "sales_document_lines_scmProductId_idx" ON "sales_document_lines"("scmProductId");

-- CreateIndex
CREATE INDEX "sales_document_lines_supplierItemId_idx" ON "sales_document_lines"("supplierItemId");

-- CreateIndex
CREATE INDEX "sales_document_lines_itemId_idx" ON "sales_document_lines"("itemId");

-- CreateIndex
CREATE INDEX "sales_document_lines_date_idx" ON "sales_document_lines"("date");

-- CreateIndex
CREATE INDEX "production_consumption_operations_productionOrderId_idx" ON "production_consumption_operations"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_consumption_operations_productionOrderItemId_idx" ON "production_consumption_operations"("productionOrderItemId");

-- CreateIndex
CREATE INDEX "production_batches_productionOrderId_idx" ON "production_batches"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_batches_productId_idx" ON "production_batches"("productId");

-- CreateIndex
CREATE INDEX "scm_supply_receipts_supplyItemId_idx" ON "scm_supply_receipts"("supplyItemId");

-- CreateIndex
CREATE INDEX "overhead_allocation_rules_scope_idx" ON "overhead_allocation_rules"("scope");

-- CreateIndex
CREATE INDEX "overhead_allocation_rules_isActive_idx" ON "overhead_allocation_rules"("isActive");

-- CreateIndex
CREATE INDEX "CurrencyRate_currency_rateDate_idx" ON "CurrencyRate"("currency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_currency_rateDate_key" ON "CurrencyRate"("currency", "rateDate");

-- CreateIndex
CREATE INDEX "AccountingEntry_docType_docId_idx" ON "AccountingEntry"("docType", "docId");

-- CreateIndex
CREATE INDEX "AccountingEntry_postingDate_idx" ON "AccountingEntry"("postingDate");

-- CreateIndex
CREATE INDEX "AccountingEntry_postingDate_countryId_brandId_idx" ON "AccountingEntry"("postingDate", "countryId", "brandId");

-- CreateIndex
CREATE INDEX "AccountingEntry_countryId_brandId_marketplaceId_idx" ON "AccountingEntry"("countryId", "brandId", "marketplaceId");

-- CreateIndex
CREATE INDEX "AccountingEntry_debitAccount_idx" ON "AccountingEntry"("debitAccount");

-- CreateIndex
CREATE INDEX "AccountingEntry_creditAccount_idx" ON "AccountingEntry"("creditAccount");

-- CreateIndex
CREATE INDEX "inventory_accounting_links_stockMovementId_idx" ON "inventory_accounting_links"("stockMovementId");

-- CreateIndex
CREATE INDEX "inventory_accounting_links_accountingEntryId_idx" ON "inventory_accounting_links"("accountingEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_accounting_links_stockMovementId_accountingEntryI_key" ON "inventory_accounting_links"("stockMovementId", "accountingEntryId");

-- CreateIndex
CREATE INDEX "os_events_status_createdAt_idx" ON "os_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "os_events_aggregateType_aggregateId_idx" ON "os_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "os_domain_objects_code_key" ON "os_domain_objects"("code");

-- CreateIndex
CREATE INDEX "os_domain_objects_domain_idx" ON "os_domain_objects"("domain");

-- CreateIndex
CREATE INDEX "os_domain_actions_actionType_idx" ON "os_domain_actions"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "os_domain_actions_objectId_code_key" ON "os_domain_actions"("objectId", "code");

-- CreateIndex
CREATE INDEX "os_lifecycles_objectId_code_idx" ON "os_lifecycles"("objectId", "code");

-- CreateIndex
CREATE INDEX "stock_reservations_warehouseId_itemId_idx" ON "stock_reservations"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "stock_reservations_reservedForType_reservedForId_idx" ON "stock_reservations"("reservedForType", "reservedForId");

-- CreateIndex
CREATE INDEX "stock_reservations_productionOrderId_idx" ON "stock_reservations"("productionOrderId");

-- CreateIndex
CREATE INDEX "inventory_adjustments_warehouseId_idx" ON "inventory_adjustments"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_adjustments_itemId_idx" ON "inventory_adjustments"("itemId");

-- CreateIndex
CREATE INDEX "inventory_adjustments_status_idx" ON "inventory_adjustments"("status");

-- CreateIndex
CREATE INDEX "finance_reports_sales_document_id_idx" ON "finance_reports"("sales_document_id");

-- CreateIndex
CREATE INDEX "finance_reports_sales_document_line_id_idx" ON "finance_reports"("sales_document_line_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_docType_docId_idx" ON "inventory_transactions"("docType", "docId");

-- CreateIndex
CREATE INDEX "stock_movements_inventoryTransactionId_idx" ON "stock_movements"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "stock_movements_consumptionOperationId_idx" ON "stock_movements"("consumptionOperationId");

-- CreateIndex
CREATE INDEX "stock_movements_productionBatchId_idx" ON "stock_movements"("productionBatchId");

-- AddForeignKey
ALTER TABLE "finance_reports" ADD CONSTRAINT "finance_reports_sales_document_id_fkey" FOREIGN KEY ("sales_document_id") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reports" ADD CONSTRAINT "finance_reports_sales_document_line_id_fkey" FOREIGN KEY ("sales_document_line_id") REFERENCES "sales_document_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_financialDocumentId_fkey" FOREIGN KEY ("financialDocumentId") REFERENCES "financial_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumption_operations" ADD CONSTRAINT "production_consumption_operations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumption_operations" ADD CONSTRAINT "production_consumption_operations_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "production_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "scm_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scm_supply_receipts" ADD CONSTRAINT "scm_supply_receipts_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "scm_supply_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_accounting_links" ADD CONSTRAINT "inventory_accounting_links_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_accounting_links" ADD CONSTRAINT "inventory_accounting_links_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_domain_actions" ADD CONSTRAINT "os_domain_actions_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "os_domain_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_lifecycles" ADD CONSTRAINT "os_lifecycles_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "os_domain_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_consumptionOperationId_fkey" FOREIGN KEY ("consumptionOperationId") REFERENCES "production_consumption_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
