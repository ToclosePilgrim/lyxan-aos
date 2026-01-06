-- Add void metadata to SCM supply receipts (TZ 8.4.3.1)
ALTER TABLE "scm_supply_receipts"
ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "voidReason" TEXT;






