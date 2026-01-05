-- TZ 8.3.B.1 — Public API support for MDM CounterpartyOffer
-- - Add legalEntity scope + offerType/status/externalRef
-- - Relax price to nullable (MVP)
-- - Note: we do NOT extend MdmItemType here; service offers use offerType=SERVICE while items are created as PRODUCT in MVP.

-- 1) Extend enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CounterpartyOfferType') THEN
    CREATE TYPE "CounterpartyOfferType" AS ENUM ('MATERIAL', 'PRODUCT', 'SERVICE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CounterpartyOfferStatus') THEN
    CREATE TYPE "CounterpartyOfferStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

-- 2) Add columns (idempotent)
ALTER TABLE "counterparty_offers"
  ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalRef" TEXT,
  ADD COLUMN IF NOT EXISTS "offerType" "CounterpartyOfferType",
  ADD COLUMN IF NOT EXISTS "status" "CounterpartyOfferStatus";

-- 3) Backfill offerType/status and legalEntityId for existing rows (best-effort)
UPDATE "counterparty_offers" co
SET "status" = CASE WHEN co."isActive" = true THEN 'ACTIVE'::"CounterpartyOfferStatus" ELSE 'ARCHIVED'::"CounterpartyOfferStatus" END
WHERE co."status" IS NULL;

UPDATE "counterparty_offers" co
SET "offerType" = CASE
  WHEN mi."type" = 'MATERIAL' THEN 'MATERIAL'::"CounterpartyOfferType"
  ELSE 'PRODUCT'::"CounterpartyOfferType"
END
FROM "mdm_items" mi
WHERE co."offerType" IS NULL AND mi."id" = co."itemId";

-- If there is at least one legal entity, assign the first one to legacy offers.
UPDATE "counterparty_offers"
SET "legalEntityId" = (
  SELECT le."id" FROM "legal_entities" le ORDER BY le."createdAt" ASC LIMIT 1
)
WHERE "legalEntityId" IS NULL;

-- 4) Enforce defaults / constraints
ALTER TABLE "counterparty_offers"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "offerType" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "legalEntityId" SET NOT NULL;

-- price becomes nullable (MVP)
ALTER TABLE "counterparty_offers"
  ALTER COLUMN "price" DROP NOT NULL;

-- 5) Add FK to legal entities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'counterparty_offers_legalEntityId_fkey'
  ) THEN
    ALTER TABLE "counterparty_offers"
      ADD CONSTRAINT "counterparty_offers_legalEntityId_fkey"
      FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6) Add indexes / unique constraints
DO $$
BEGIN
  -- Unique (legalEntityId, counterpartyId, itemId)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counterparty_offers_legalEntity_counterparty_item_key'
  ) THEN
    ALTER TABLE "counterparty_offers"
      ADD CONSTRAINT "counterparty_offers_legalEntity_counterparty_item_key"
      UNIQUE ("legalEntityId", "counterpartyId", "itemId");
  END IF;

  -- Unique (legalEntityId, counterpartyId, externalRef) — nullable-safe in Postgres (multiple NULL allowed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counterparty_offers_legalEntity_counterparty_externalRef_key'
  ) THEN
    ALTER TABLE "counterparty_offers"
      ADD CONSTRAINT "counterparty_offers_legalEntity_counterparty_externalRef_key"
      UNIQUE ("legalEntityId", "counterpartyId", "externalRef");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "counterparty_offers_legalEntityId_counterpartyId_idx"
  ON "counterparty_offers" ("legalEntityId", "counterpartyId");

CREATE INDEX IF NOT EXISTS "counterparty_offers_legalEntityId_itemId_idx"
  ON "counterparty_offers" ("legalEntityId", "itemId");

CREATE INDEX IF NOT EXISTS "counterparty_offers_legalEntityId_status_idx"
  ON "counterparty_offers" ("legalEntityId", "status");

CREATE INDEX IF NOT EXISTS "counterparty_offers_legalEntityId_offerType_idx"
  ON "counterparty_offers" ("legalEntityId", "offerType");


