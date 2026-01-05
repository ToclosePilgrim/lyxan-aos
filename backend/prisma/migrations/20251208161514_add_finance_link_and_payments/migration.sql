-- CreateEnum
CREATE TYPE "FinanceLinkedDocType" AS ENUM ('SUPPLY', 'PRODUCTION_ORDER', 'SERVICE_OPERATION', 'STOCK_ADJUSTMENT', 'OTHER');

-- AlterTable
ALTER TABLE "financial_documents" ADD COLUMN     "linkedDocId" TEXT,
ADD COLUMN     "linkedDocType" "FinanceLinkedDocType";

-- CreateTable
CREATE TABLE "finance_payments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "externalRef" TEXT,
    "comment" TEXT,

    CONSTRAINT "finance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_payments_documentId_idx" ON "finance_payments"("documentId");

-- CreateIndex
CREATE INDEX "financial_documents_linkedDocType_idx" ON "financial_documents"("linkedDocType");

-- CreateIndex
CREATE INDEX "financial_documents_linkedDocId_idx" ON "financial_documents"("linkedDocId");

-- AddForeignKey
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "financial_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
