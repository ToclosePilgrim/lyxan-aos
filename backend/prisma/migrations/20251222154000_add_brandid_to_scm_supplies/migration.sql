-- Add brandId to scm_supplies to support accounting scope (brand+country) for supply receipts

ALTER TABLE "scm_supplies" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

CREATE INDEX IF NOT EXISTS "scm_supplies_brandId_idx" ON "scm_supplies"("brandId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scm_supplies_brandId_fkey'
  ) THEN
    ALTER TABLE "scm_supplies"
      ADD CONSTRAINT "scm_supplies_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "brands"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;



ALTER TABLE "scm_supplies" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

CREATE INDEX IF NOT EXISTS "scm_supplies_brandId_idx" ON "scm_supplies"("brandId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scm_supplies_brandId_fkey'
  ) THEN
    ALTER TABLE "scm_supplies"
      ADD CONSTRAINT "scm_supplies_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "brands"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


