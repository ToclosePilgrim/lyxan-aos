# DEPRECATED — SCM Stocks API (old)

This document is **deprecated** and does **not** reflect the current architecture.

Canonical truth:
- `docs/architecture/SCM_FINANCE_CANON.md`

---

Original text (kept for history):

## Назначение
- Единый публичный API для UI/агентов по остаткам: работает на новом контуре ScmStock + stockMovement + stockBatch (FIFO).
- Не использовать legacy `Stock` / `sku.stocks` / эндпоинты из `scm.controller.ts`.
- Низкоуровневый ledger `/inventory/...` — для технических сценариев (глубокие проводки, аудит).

## Эндпоинты

- `GET /scm/stocks` — список остатков (ScmStock) с фильтрами `warehouseId`, `supplierItemId`, `scmProductId|productId`, `search`.
- `GET /scm/stocks/summary` — агрегация по товару/позиции (без разреза по складу).
- `GET /scm/stocks/batches` — остатки по партиям (production batches, FIFO).
- `GET /scm/stocks/ledger` — движения (stockMovement) с пагинацией.
- `POST /scm/stocks/adjust` — ручная корректировка.
- `POST /scm/stocks/recalculate` — пересчёт из движений.


