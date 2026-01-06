-- TZ 10.1 — Sales returns with restock (SalesReturnOperation + SALE_RETURN doc types)

-- 1) Add enum values (forward-only; safe if rerun)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AccountingDocType' AND e.enumlabel = 'SALE_RETURN'
  ) THEN
    ALTER TYPE "AccountingDocType" ADD VALUE 'SALE_RETURN';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MovementDocType' AND e.enumlabel = 'SALE_RETURN'
  ) THEN
    ALTER TYPE "MovementDocType" ADD VALUE 'SALE_RETURN';
  END IF;
END
$$;

-- 2) SalesReturnOperationStatus enum
DO $$
BEGIN
  CREATE TYPE "SalesReturnOperationStatus" AS ENUM ('CREATED', 'POSTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 3) Tables
CREATE TABLE IF NOT EXISTS "sales_return_operations" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "saleId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" "SalesReturnOperationStatus" NOT NULL DEFAULT 'CREATED',
  "totalRefundBase" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalCostReturnedBase" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "postingRunId" TEXT,
  "reason" TEXT,
  "meta" JSONB,
  CONSTRAINT "sales_return_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sales_return_operations_idempotencyKey_key"
  ON "sales_return_operations"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "sales_return_operations_saleId_idx"
  ON "sales_return_operations"("saleId");
CREATE INDEX IF NOT EXISTS "sales_return_operations_le_occurred_idx"
  ON "sales_return_operations"("legalEntityId","occurredAt");
CREATE INDEX IF NOT EXISTS "sales_return_operations_postingRunId_idx"
  ON "sales_return_operations"("postingRunId");

DO $$
BEGIN
  ALTER TABLE "sales_return_operations"
    ADD CONSTRAINT "sales_return_operations_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "sales_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "sales_return_operations"
    ADD CONSTRAINT "sales_return_operations_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "sales_return_operation_lines" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "returnOperationId" TEXT NOT NULL,
  "saleLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "quantity" DECIMAL(14, 4) NOT NULL,
  "refundAmountBase" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "costBaseReturned" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "originalMovementId" TEXT,
  "meta" JSONB,
  CONSTRAINT "sales_return_operation_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sales_return_operation_lines_returnOperationId_idx"
  ON "sales_return_operation_lines"("returnOperationId");
CREATE INDEX IF NOT EXISTS "sales_return_operation_lines_saleLineId_idx"
  ON "sales_return_operation_lines"("saleLineId");
CREATE INDEX IF NOT EXISTS "sales_return_operation_lines_originalMovementId_idx"
  ON "sales_return_operation_lines"("originalMovementId");

CREATE UNIQUE INDEX IF NOT EXISTS "sales_return_operation_lines_op_movement_key"
  ON "sales_return_operation_lines"("returnOperationId","originalMovementId");

DO $$
BEGIN
  ALTER TABLE "sales_return_operation_lines"
    ADD CONSTRAINT "sales_return_operation_lines_returnOperationId_fkey"
    FOREIGN KEY ("returnOperationId") REFERENCES "sales_return_operations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "sales_return_operation_lines"
    ADD CONSTRAINT "sales_return_operation_lines_saleLineId_fkey"
    FOREIGN KEY ("saleLineId") REFERENCES "sales_document_lines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "sales_return_operation_lines"
    ADD CONSTRAINT "sales_return_operation_lines_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "mdm_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "sales_return_operation_lines"
    ADD CONSTRAINT "sales_return_operation_lines_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "sales_return_operation_lines"
    ADD CONSTRAINT "sales_return_operation_lines_originalMovementId_fkey"
    FOREIGN KEY ("originalMovementId") REFERENCES "stock_movements"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;


