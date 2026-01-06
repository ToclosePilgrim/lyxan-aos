# Runbook — Data integrity (what we monitor)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## Invariants to monitor

### Scope isolation
- Non-superadmin reads must be scoped to `legalEntityId` (and allowed warehouses where applicable).

### Idempotency
- High-level: repeated mutating requests with the same `Idempotency-Key` must replay the same response.
- Domain-level: `idempotencyKey` uniques prevent duplicate inventory writes.

### Inventory costing (base currency)
- No mixed-currency sums; batches store `unitCostBase` and `fxRateToBase`.

### Ledger balance validation
- Posting runs must satisfy: `sum(debit.amountBase) == sum(credit.amountBase)` (prod always-on).

### Agents security
- Callback requires valid HMAC and replay protection (Redis).


