-- TZ 1.1 — Add legalEntityId to AccountingEntry (step B: enforce NOT NULL + FK)

-- Re-run backfill to be safe
UPDATE "AccountingEntry" ae
SET "legalEntityId" = bc."legalEntityId"
FROM "brand_countries" bc
WHERE ae."legalEntityId" IS NULL
  AND ae."brandId" = bc."brandId"
  AND ae."countryId" = bc."countryId"
  AND bc."legalEntityId" IS NOT NULL;

-- Fail fast if coverage is not 100%
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AccountingEntry" WHERE "legalEntityId" IS NULL) THEN
    RAISE EXCEPTION 'TZ 1.1: AccountingEntry.legalEntityId backfill incomplete. Run coverage check and configure BrandCountry.legalEntityId for all used brand+country.';
  END IF;
END $$;

ALTER TABLE "AccountingEntry"
  ALTER COLUMN "legalEntityId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingEntry_legalEntityId_fkey'
  ) THEN
    ALTER TABLE "AccountingEntry"
      ADD CONSTRAINT "AccountingEntry_legalEntityId_fkey"
      FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;




