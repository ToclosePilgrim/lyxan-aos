# TZ 12 — Cleanup (API): remove/alias legacy endpoints, ban second paths

## Canonical runtime APIs

- Inventory reports: `/inventory/report/*` (scoped by allowed warehouses)
- Finance P&L: `/finance/pnl` (ledger-based)
- Agents run: `POST /agents/run` (queues BullMQ, returns 202)
- Agents callback: `POST /agents/callback/:runId` (HMAC + replay protection)

## Legacy / historical endpoints (policy)

If an endpoint must remain for compatibility, it is kept as a **deprecated alias**:
- calls canonical service internally (single implementation)
- emits `deprecated_endpoint` warning log
- must respect scope + idempotency/validation invariants
- no legacy write-paths

## Changes made in TZ12

### 1) `os/v1/inventory/*` → deprecated aliases over canonical inventory report service

- `os/v1/inventory/balances|batches|movements` now call `InventoryReportService` internally.
- Purpose: keep OS API stable while eliminating “second implementation” and ensuring scope is enforced.

### 2) `os/v1/dwh/*` and `os/v1/export/raw` — integration only, superadmin-only

- These endpoints are **not** a source-of-truth for runtime business decisions.
- Access is now restricted to `role in {Admin, SuperAdmin}`.

### 3) `scm/stocks/*` legacy alias — scope hardened

- Read endpoints now restrict to allowed warehouses for non-admin users.
- Write endpoints remain disabled except canonical `/scm/stocks/adjust`.


