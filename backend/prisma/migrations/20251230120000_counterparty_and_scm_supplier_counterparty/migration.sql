-- 8.3.A Architecture Lockdown: MDM Counterparty ↔ SCM boundary
-- - Replace legacy Supplier model usage with Counterparty model in Prisma (table stays "suppliers")
-- - SCM references Counterparty via *supplierCounterpartyId* (no SCM supplier directory)

-- 1) Counterparty roles (MVP)
DO $$
BEGIN
  CREATE TYPE "CounterpartyRole" AS ENUM ('SUPPLIER', 'SERVICE_PROVIDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "roles" "CounterpartyRole"[] NOT NULL
  DEFAULT ARRAY['SUPPLIER']::"CounterpartyRole"[];

-- 2) SCM: rename supplierId -> supplierCounterpartyId
ALTER TABLE "scm_supplies"
  RENAME COLUMN "supplierId" TO "supplierCounterpartyId";

ALTER TABLE "scm_product_suppliers"
  RENAME COLUMN "supplierId" TO "supplierCounterpartyId";

ALTER TABLE "scm_service_operations"
  RENAME COLUMN "supplierId" TO "supplierCounterpartyId";




