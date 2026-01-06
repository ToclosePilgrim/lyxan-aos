# Runbook — Operations checklist (SCM + Finance)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## Health & dependencies

- Backend:
  - `GET /api/health` → `{ status: "ok" }`
- DB:
  - `GET /api/health/db` is OK
- Redis:
  - required for idempotency, replay protection, BullMQ

---

## SCM/Inventory smoke

- Supply receipt flow creates:
  - `StockBatch` (IN)
  - `StockMovement` (IN)
  - `InventoryTransaction` correlation
- Inventory report reflects movements/balances (no second SoT)

---

## Finance smoke

- Posting creates `AccountingPostingRun` and `AccountingEntry`
- Always-on balance validation blocks unbalanced postings

---

## Agents smoke

- `POST /api/agents/run` returns `202` and queues job
- Callback rejects missing/invalid HMAC and rejects replays


