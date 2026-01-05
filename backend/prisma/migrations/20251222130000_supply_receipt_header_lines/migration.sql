-- Unify supply receiving pipeline: receipt-driven (header + lines)
-- Convert existing `scm_supply_receipts` (line-level) into `scm_supply_receipt_lines`
-- and introduce `scm_supply_receipts` as receipt header.

-- 1) Rename old line table
ALTER TABLE "scm_supply_receipts" RENAME TO "scm_supply_receipt_lines";

-- IMPORTANT: primary key index keeps old name after table rename -> rename it to avoid conflict
-- (otherwise CREATE TABLE "scm_supply_receipts" ... PRIMARY KEY will try to create same index name)
ALTER INDEX IF EXISTS "scm_supply_receipts_pkey" RENAME TO "scm_supply_receipt_lines_pkey";

-- 2) Create header table
CREATE TABLE "scm_supply_receipts" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "supplyId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "comment" TEXT,
  CONSTRAINT "scm_supply_receipts_pkey" PRIMARY KEY ("id")
);

-- 3) Add receiptId FK to lines
ALTER TABLE "scm_supply_receipt_lines"
  ADD COLUMN "receiptId" TEXT;

-- 4) Backfill: create 1 header per existing line (id = line.id), and set line.receiptId = line.id
INSERT INTO "scm_supply_receipts" ("id","createdAt","updatedAt","supplyId","receivedAt","currency","comment")
SELECT
  l."id",
  l."createdAt",
  l."updatedAt",
  si."supplyId",
  l."receivedAt",
  l."currency",
  l."comment"
FROM "scm_supply_receipt_lines" l
JOIN "scm_supply_items" si ON si."id" = l."supplyItemId"
ON CONFLICT ("id") DO NOTHING;

UPDATE "scm_supply_receipt_lines" SET "receiptId" = "id" WHERE "receiptId" IS NULL;

-- 5) Make receiptId required and add FK + indexes
ALTER TABLE "scm_supply_receipt_lines"
  ALTER COLUMN "receiptId" SET NOT NULL;

CREATE INDEX "scm_supply_receipts_supplyId_idx" ON "scm_supply_receipts"("supplyId");
CREATE INDEX "scm_supply_receipt_lines_receiptId_idx" ON "scm_supply_receipt_lines"("receiptId");
CREATE INDEX "scm_supply_receipt_lines_supplyItemId_idx" ON "scm_supply_receipt_lines"("supplyItemId");

ALTER TABLE "scm_supply_receipts"
  ADD CONSTRAINT "scm_supply_receipts_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "scm_supplies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scm_supply_receipt_lines"
  ADD CONSTRAINT "scm_supply_receipt_lines_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "scm_supply_receipts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: existing FK from old scm_supply_receipts to scm_supply_items remains on renamed table
-- (constraint name may still reference old table name, which is acceptable in Postgres).


