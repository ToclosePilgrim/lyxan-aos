-- Supply Receipt Linking Hardening (TZ 0.3)
-- Make supplyReceiptId a first-class column on stock_movements, backfilled from meta->>'supplyReceiptId'

ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "supplyReceiptId" TEXT;

-- backfill from existing meta JSON (kept for backwards compatibility)
UPDATE "stock_movements"
SET "supplyReceiptId" = ("meta"->>'supplyReceiptId')
WHERE "supplyReceiptId" IS NULL
  AND "meta" IS NOT NULL
  AND ("meta"->>'supplyReceiptId') IS NOT NULL
  AND ("meta"->>'supplyReceiptId') <> '';

-- FK (soft, keep row if receipt deleted)
ALTER TABLE "stock_movements"
  DROP CONSTRAINT IF EXISTS "stock_movements_supplyReceiptId_fkey";

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_supplyReceiptId_fkey"
  FOREIGN KEY ("supplyReceiptId") REFERENCES "scm_supply_receipts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "stock_movements_supplyReceiptId_idx" ON "stock_movements"("supplyReceiptId");
CREATE INDEX IF NOT EXISTS "stock_movements_docType_docId_supplyReceiptId_idx"
  ON "stock_movements"("docType","docId","supplyReceiptId");
