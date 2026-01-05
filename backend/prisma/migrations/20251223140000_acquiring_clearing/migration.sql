-- TZ 5.3 — Acquiring clearing: events + posting via clearing accounts

-- 1) Accounting doc type
DO $$
BEGIN
  ALTER TYPE "AccountingDocType" ADD VALUE IF NOT EXISTS 'ACQUIRING_EVENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Enums
DO $$
BEGIN
  CREATE TYPE "AcquiringEventType" AS ENUM ('PAYMENT_CAPTURED', 'PAYMENT_REFUNDED', 'FEE_CHARGED', 'SETTLEMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "AcquiringEventStatus" AS ENUM ('IMPORTED', 'POSTED', 'IGNORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "AcquiringAccountingLinkRole" AS ENUM ('PRINCIPAL', 'FEE', 'REFUND', 'SETTLEMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 3) Tables
CREATE TABLE IF NOT EXISTS "acquiring_events" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "legalEntityId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventType" "AcquiringEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBase" DECIMAL(18,2) NOT NULL,
  "externalRef" TEXT NOT NULL,
  "orderId" TEXT,
  "statementLineId" TEXT,
  "status" "AcquiringEventStatus" NOT NULL DEFAULT 'IMPORTED',
  "raw" JSONB
);

CREATE TABLE IF NOT EXISTS "acquiring_accounting_links" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acquiringEventId" TEXT NOT NULL,
  "accountingEntryId" TEXT NOT NULL,
  "role" "AcquiringAccountingLinkRole" NOT NULL
);

-- 4) Constraints / FKs
DO $$
BEGIN
  ALTER TABLE "acquiring_events"
    ADD CONSTRAINT "acquiring_events_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "acquiring_events"
    ADD CONSTRAINT "acquiring_events_statementLineId_fkey"
    FOREIGN KEY ("statementLineId") REFERENCES "statement_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "acquiring_accounting_links"
    ADD CONSTRAINT "acquiring_accounting_links_acquiringEventId_fkey"
    FOREIGN KEY ("acquiringEventId") REFERENCES "acquiring_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "acquiring_accounting_links"
    ADD CONSTRAINT "acquiring_accounting_links_accountingEntryId_fkey"
    FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 5) Indexes + uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "acquiring_events_unique_event_idx"
  ON "acquiring_events" ("legalEntityId", "provider", "externalRef", "eventType");

CREATE INDEX IF NOT EXISTS "acquiring_events_legalEntityId_occurredAt_idx"
  ON "acquiring_events" ("legalEntityId", "occurredAt");

CREATE INDEX IF NOT EXISTS "acquiring_events_provider_occurredAt_idx"
  ON "acquiring_events" ("provider", "occurredAt");

CREATE INDEX IF NOT EXISTS "acquiring_events_status_occurredAt_idx"
  ON "acquiring_events" ("status", "occurredAt");

CREATE INDEX IF NOT EXISTS "acquiring_events_statementLineId_idx"
  ON "acquiring_events" ("statementLineId");

CREATE UNIQUE INDEX IF NOT EXISTS "acquiring_accounting_links_unique_idx"
  ON "acquiring_accounting_links" ("acquiringEventId", "accountingEntryId", "role");

CREATE INDEX IF NOT EXISTS "acquiring_accounting_links_acquiringEventId_idx"
  ON "acquiring_accounting_links" ("acquiringEventId");

CREATE INDEX IF NOT EXISTS "acquiring_accounting_links_accountingEntryId_idx"
  ON "acquiring_accounting_links" ("accountingEntryId");


