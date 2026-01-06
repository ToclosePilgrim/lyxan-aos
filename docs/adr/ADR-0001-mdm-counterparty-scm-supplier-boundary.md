# ADR-0001: MDM Counterparty ↔ SCM Supplier Boundary

## Status

**Accepted** (Architecture Lockdown)

## Decision

**MDM owns Counterparties; SCM references them.**

- `MDM.Counterparty` is the single source of truth (SoT) for any counterparty:
  - supplier
  - service provider / contractor
  - bank
  - marketplace
  - etc.
- SCM stores only operational entities (supplies, receipts, movements, production orders, etc.) and **references** `Counterparty`.

## Why

- **Single directory**: no duplicates, no drift between “Supplier” lists.
- **Finance traceability**: accounting/treasury links can consistently point to the same counterparty entity.
- **Less tech debt**: prevents “quick fixes” that re-introduce parallel directories and break invariants over time.
- **Cleaner boundaries**: SCM stays operational; MDM stays reference/master-data.

## What is forbidden

- **SCM Suppliers CRUD** and any routes under:
  - `/api/scm/suppliers*`
- **Prisma `model Supplier`** as a master-data directory.
- Any SCM FK that implies SCM owns a supplier directory:
  - `supplierId` (as FK to SCM supplier directory)
- Runtime references that re-introduce SCM supplier directory concepts:
  - `SuppliersController`, `SuppliersService`
  - module path `src/modules/scm/suppliers`
  - route strings `scm/suppliers`, `/api/scm/suppliers`

## What is required

- `ScmSupply.supplierCounterpartyId` (FK → `Counterparty.id`)
- Supply create/update must validate:
  - referenced `Counterparty` exists
  - `Counterparty.roles` contains `SUPPLIER`
- Migration policy for legacy SCM suppliers:
  - **read-only → remove**
  - no new dependencies on legacy supplier directory

## Guardrails (CI / local checks)

The repo must include a hard quality gate that fails the build if forbidden patterns are introduced (see `backend/tools/architecture-lockdown-check.ts`).

## DoD

- This ADR exists.
- Linked from the repo docs index / README.







