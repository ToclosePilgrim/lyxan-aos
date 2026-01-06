-- TZ 3 — Add idempotency keys to InventoryTransaction and StockMovement

-- Add idempotencyKey to InventoryTransaction
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Add unique constraint on idempotencyKey (PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transactions_idempotencyKey_key" 
  ON "inventory_transactions"("idempotencyKey") 
  WHERE "idempotencyKey" IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "inventory_transactions_idempotencyKey_idx" 
  ON "inventory_transactions"("idempotencyKey");

-- Add idempotencyKey to StockMovement
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Add unique constraint on idempotencyKey (PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_idempotencyKey_key" 
  ON "stock_movements"("idempotencyKey") 
  WHERE "idempotencyKey" IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "stock_movements_idempotencyKey_idx" 
  ON "stock_movements"("idempotencyKey");



