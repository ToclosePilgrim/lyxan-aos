-- TZ 8.4.3.2: void metadata for production postings

ALTER TABLE "inventory_transactions"
ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

ALTER TABLE "production_orders"
ADD COLUMN IF NOT EXISTS "completionVoidedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "completionVoidReason" TEXT;



