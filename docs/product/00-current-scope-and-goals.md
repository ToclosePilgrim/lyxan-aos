# 00 — Current scope & goals (now)

This document defines what Ly[x]an AOS **is today** and what we treat as “done enough” for the next 1–2 months.

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## What AOS is (current)

Ly[x]an AOS is an ERP-first system for e-commerce operations with an agent-friendly backend.

### What is already “canon”
- **Inventory**: FIFO movements/batches + balance read-model, events, idempotency
- **Finance**: immutable ledger + posting runs + always-on balance validation in prod
- **Sales**:
  - `SALES_DOCUMENT` posting (revenue + COGS + links)
  - `SALE_RETURN` with restock (inventory IN at historical cost + revenue/COGS reversal + links)
- **Agents**:
  - async dispatch via BullMQ
  - secure callback (HMAC + replay protection)
- **Multi-tenant isolation**: request scope + scoped reads (legalEntityId MVP, warehouse scoping where needed)

---

## What is explicitly NOT in scope (right now)

- Advertising optimization as a primary business loop
- Product content automation as a primary business loop
- “RAW as runtime SoT” (RAW/DWH are integration layers only)

---

## Goals for the next 1–2 months (definition of success)

- **Operational correctness**:
  - no duplicate postings/movements under retries
  - strict tenant isolation
  - base-currency costing stays consistent
  - always-on balance validation blocks invalid postings
- **Sufficient UI** to run core SCM + Finance flows end-to-end
- **Reliable deployment** with repeatable runbooks and CI guardrails
- **First useful agents** (SCM + Finance) built on canonical APIs (no second paths)


