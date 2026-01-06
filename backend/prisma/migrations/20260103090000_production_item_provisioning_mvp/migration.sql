-- TZ 8.3.B.2 — Production provisioning MVP support
-- Adds audit/meta fields for provisioning and a compound index for fast "missing provisioning" queries.

ALTER TABLE "production_order_items"
  ADD COLUMN IF NOT EXISTS "provisionedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "provisionedWarehouseId" TEXT,
  ADD COLUMN IF NOT EXISTS "provisionMeta" JSONB;

CREATE INDEX IF NOT EXISTS "production_order_items_productionOrderId_provisionStatus_idx"
  ON "production_order_items" ("productionOrderId", "provisionStatus");






