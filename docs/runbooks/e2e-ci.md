# Runbook — E2E in CI (required guardrails)

This document lists the **minimum** e2e specs that must run in CI on every PR, because they protect the SCM+Finance canon from regressions.

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## Must-run e2e specs

Already in CI:
- `backend/test/finance-balance-validation.e2e-spec.ts` (TZ7)
- `backend/test/sales-posting.e2e-spec.ts` (TZ10)
- `backend/test/sales-return-restock.e2e-spec.ts` (TZ10.1)

Should be added (security + core correctness):
- `backend/test/scm-supplies-scope.e2e-spec.ts` (TZ5 scope isolation)
- `backend/test/finance-entries-scope.e2e-spec.ts` (TZ5 scope isolation)
- `backend/test/agents-callback-hmac.e2e-spec.ts` (TZ1 callback security)
- `backend/test/idempotency.e2e-spec.ts` (TZ2 global idempotency)
- `backend/test/supply-receipt-idempotency.e2e-spec.ts` (TZ3 domain idempotency)
- `backend/test/inventory-events-multiout.e2e-spec.ts` (TZ4 multi-movement events)
- `backend/test/fifo-mixed-currency-basecost.e2e-spec.ts` (TZ8 base currency costing)


