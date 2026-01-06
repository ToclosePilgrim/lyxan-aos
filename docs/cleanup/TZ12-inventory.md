# TZ 12 — Cleanup (Inventory): single source of truth + legacy path audit

## Canon (SoT)

- **Movements**: `StockMovement`
- **Batches**: `StockBatch`
- **Balances (read-model)**: `InventoryBalance`
- **All inventory writes**: only via `InventoryOrchestratorService` + `FifoInventoryService`

## Findings (legacy / second paths)

### 1) `os/v1/inventory/*` (OS API) was a second read-path and also broken

- Old implementation queried `inventoryBalance` with legacy fields (`productId`, `supplierItemId`) which do not exist on `InventoryBalance` anymore.
- It also bypassed canonical scope enforcement for inventory tables (warehouse-based scoping).

**Action**
- `os/v1/inventory/balances|batches|movements` are now **deprecated aliases** over canonical `InventoryReportService`:
  - log warning `deprecated_endpoint: ...`
  - reuse canonical filtering + scope checks
  - keep minimal backward-compat mapping: `productId/supplierItemId -> itemId` for balances

### 2) `scm/stocks/*` (legacy alias) did not enforce tenant scope on read

- `ScmStocksService` reads `InventoryBalance` / `StockBatch` / `StockMovement` directly and previously relied only on RolesGuard.
- Inventory tables are scoped via **allowed warehouses**, so this was a potential cross-tenant read leak.

**Action**
- `ScmStocksService` now enforces scope for non-admin users:
  - restricts queries to `warehouseId IN allowedWarehouseIds` when `warehouseId` not provided
  - validates `warehouseId` is allowed when provided
  - logs `deprecated_endpoint_backend: ...` for legacy alias usage

## Guardrails (prevent returning “second write paths”)

- `backend/src/common/guardrails/no-direct-inventory-writes.spec.ts`
  - CI fails if any code (outside allowlist) uses:
    - `.stockMovement.(create|update|upsert|delete...)`
    - `.stockBatch.(create|update|upsert|delete...)`
    - `.inventoryBalance.(create|update|upsert|delete...)`


