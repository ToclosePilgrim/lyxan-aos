-- TZ 1.1 — Add legalEntityId to AccountingEntry (step A: nullable + backfill)

ALTER TABLE "AccountingEntry" ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT;

-- Backfill via BrandCountry mapping (brandId + countryId -> legalEntityId)
UPDATE "AccountingEntry" ae
SET "legalEntityId" = bc."legalEntityId"
FROM "brand_countries" bc
WHERE ae."legalEntityId" IS NULL
  AND ae."brandId" = bc."brandId"
  AND ae."countryId" = bc."countryId"
  AND bc."legalEntityId" IS NOT NULL;

-- Indexes for reporting / drill-down
CREATE INDEX IF NOT EXISTS "AccountingEntry_legalEntityId_postingDate_idx"
  ON "AccountingEntry"("legalEntityId","postingDate");
CREATE INDEX IF NOT EXISTS "AccountingEntry_legalEntityId_docType_docId_idx"
  ON "AccountingEntry"("legalEntityId","docType","docId");
