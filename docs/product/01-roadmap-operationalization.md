# 01 — Roadmap: operationalization (1–6 steps)

This is the execution roadmap to make the current SCM+Finance canon operationally safe and easy to run.
Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## Step 1 — Correctness guardrails (CI)

**DoD**
- CI runs a minimal set of **must-not-regress** e2e tests:
  - finance balance validation (TZ7)
  - sales posting (TZ10)
  - sales return restock (TZ10.1)
  - scope isolation tests (TZ5)

## Step 2 — Runtime monitoring & integrity checks

**DoD**
- Operators can quickly answer:
  - Are postings balanced?
  - Are there idempotency/replay errors?
  - Are there scope violations?

## Step 3 — UI sufficiency for SCM+Finance

**DoD**
- UI covers core flows:
  - supply receipt → inventory balances
  - sales posting → ledger + links
  - sales return restock → inventory IN + reversals

## Step 4 — Pricing + self-buy (not revenue optimization yet)

**DoD**
- Basic pricing workflows exist, but do not override canon accounting logic.

## Step 5 — DWH / BigQuery / Tableau (non-core integration)

**DoD**
- RAW/core/marts are documented as **integration-only**; runtime reads canon tables/read-models only.

## Step 6 — First agents for SCM+Finance

**DoD**
- Agents use:
  - async dispatch queue
  - secure callback
  - idempotent endpoints
  - and operate only on canonical flows


