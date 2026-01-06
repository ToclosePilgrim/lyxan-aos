-- TZ 7.2 — cashflow_categories transfer flag

ALTER TABLE "cashflow_categories"
  ADD COLUMN IF NOT EXISTS "isTransfer" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "cashflow_categories_isTransfer_idx"
  ON "cashflow_categories"("isTransfer");

-- Mark internal transfer category as transfer (if present)
UPDATE "cashflow_categories"
SET "isTransfer" = true
WHERE "code" IN ('CF_TRANSFER_INTERNAL');








