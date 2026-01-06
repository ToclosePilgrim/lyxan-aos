-- TZ 10.0.1 — Sales posting hardening: link type and extra join columns for explainability

DO $$ BEGIN
  CREATE TYPE "InventoryAccountingLinkType" AS ENUM ('COGS', 'INVENTORY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "inventory_accounting_links"
ADD COLUMN IF NOT EXISTS "linkType" "InventoryAccountingLinkType",
ADD COLUMN IF NOT EXISTS "postingRunId" TEXT,
ADD COLUMN IF NOT EXISTS "inventoryTransactionId" TEXT,
ADD COLUMN IF NOT EXISTS "batchId" TEXT;

-- Replace unique constraint: allow two links per movement+entry (COGS vs INVENTORY)
DO $$ BEGIN
  ALTER TABLE "inventory_accounting_links"
    DROP CONSTRAINT IF EXISTS "inventory_accounting_links_stockMovementId_accountingEntryId_key";
EXCEPTION WHEN undefined_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_accounting_links_stockMovementId_accountingEntryId_linkType_key"
ON "inventory_accounting_links" ("stockMovementId", "accountingEntryId", "linkType");

CREATE INDEX IF NOT EXISTS "inventory_accounting_links_postingRunId_idx"
ON "inventory_accounting_links" ("postingRunId");
CREATE INDEX IF NOT EXISTS "inventory_accounting_links_inventoryTransactionId_idx"
ON "inventory_accounting_links" ("inventoryTransactionId");
CREATE INDEX IF NOT EXISTS "inventory_accounting_links_batchId_idx"
ON "inventory_accounting_links" ("batchId");


