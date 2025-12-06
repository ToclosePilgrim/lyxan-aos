-- CreateEnum: Add new FinancialDocumentDirection
CREATE TYPE "FinancialDocumentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum: Create FinancialDocumentType if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "FinancialDocumentType" AS ENUM ('INVOICE', 'BILL', 'ACT', 'CREDIT_NOTE', 'OTHER', 'SUPPLY_INVOICE', 'PRODUCTION_INVOICE', 'SERVICE_INVOICE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: Create FinancialDocumentStatus if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "FinancialDocumentStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'ISSUED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add new values to FinancialDocumentType (if enum already exists)
DO $$ BEGIN
    ALTER TYPE "FinancialDocumentType" ADD VALUE IF NOT EXISTS 'BILL';
    ALTER TYPE "FinancialDocumentType" ADD VALUE IF NOT EXISTS 'CREDIT_NOTE';
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- AlterEnum: Add new value to FinancialDocumentStatus (if enum already exists)
DO $$ BEGIN
    ALTER TYPE "FinancialDocumentStatus" ADD VALUE IF NOT EXISTS 'SENT';
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- CreateTable: Create financial_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS "financial_documents" (
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
    "externalId" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "number" TEXT,
    "date" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "comment" TEXT,
    "totalAmount" DECIMAL(14,4),
    "supplyId" TEXT,

    CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add new columns to financial_documents (if table already exists)
DO $$ BEGIN
    ALTER TABLE "financial_documents" 
      ADD COLUMN IF NOT EXISTS "docNumber" TEXT,
      ADD COLUMN IF NOT EXISTS "docDate" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "direction" "FinancialDocumentDirection",
      ADD COLUMN IF NOT EXISTS "scmSupplyId" TEXT,
      ADD COLUMN IF NOT EXISTS "amountTotal" DECIMAL(14,4),
      ADD COLUMN IF NOT EXISTS "externalId" TEXT,
      ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "notes" TEXT;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

-- Copy data from old fields to new fields (for backward compatibility)
DO $$ BEGIN
    UPDATE "financial_documents" SET "docNumber" = "number" WHERE "docNumber" IS NULL AND "number" IS NOT NULL;
    UPDATE "financial_documents" SET "docDate" = "date" WHERE "docDate" IS NULL AND "date" IS NOT NULL;
    UPDATE "financial_documents" SET "scmSupplyId" = "supplyId" WHERE "scmSupplyId" IS NULL AND "supplyId" IS NOT NULL;
    UPDATE "financial_documents" SET "amountTotal" = "totalAmount" WHERE "amountTotal" IS NULL AND "totalAmount" IS NOT NULL;
    UPDATE "financial_documents" SET "notes" = "comment" WHERE "notes" IS NULL AND "comment" IS NOT NULL;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

-- AlterTable: Make some fields nullable for flexibility
DO $$ BEGIN
    ALTER TABLE "financial_documents" 
      ALTER COLUMN "number" DROP NOT NULL,
      ALTER COLUMN "date" DROP NOT NULL,
      ALTER COLUMN "totalAmount" DROP NOT NULL,
      ALTER COLUMN "currency" DROP NOT NULL,
      ALTER COLUMN "type" DROP NOT NULL,
      ALTER COLUMN "status" DROP DEFAULT;
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN undefined_column THEN null;
END $$;

-- AddForeignKey for supplierId
DO $$ BEGIN
    ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_supplierId_fkey" 
      FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;

-- AddForeignKey for productionOrderId
DO $$ BEGIN
    ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_productionOrderId_fkey" 
      FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;

-- AddForeignKey for scmSupplyId
DO $$ BEGIN
    ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_scmSupplyId_fkey" 
      FOREIGN KEY ("scmSupplyId") REFERENCES "scm_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "financial_documents_supplierId_idx" ON "financial_documents"("supplierId");
CREATE INDEX IF NOT EXISTS "financial_documents_productionOrderId_idx" ON "financial_documents"("productionOrderId");
CREATE INDEX IF NOT EXISTS "financial_documents_scmSupplyId_idx" ON "financial_documents"("scmSupplyId");
CREATE INDEX IF NOT EXISTS "financial_documents_docNumber_idx" ON "financial_documents"("docNumber");
CREATE INDEX IF NOT EXISTS "financial_documents_status_idx" ON "financial_documents"("status");

