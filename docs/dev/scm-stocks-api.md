# SCM Stocks API (deprecated alias, current behavior)

## Назначение
- Этот модуль **не является SoT** остатков. Он существует как **deprecated read-alias** для совместимости.
- Канонический SoT по запасам: `StockMovement` + `StockBatch` + `InventoryBalance` (read-model).
- Канонический документ: `docs/architecture/SCM_FINANCE_CANON.md`.

## Эндпоинты

- `GET /scm/stocks` — read-only выдача остатков по складу (агрегация из каноничных таблиц).
- `GET /scm/stocks/batches` — read-only выдача партий/остатков (из `StockBatch`/`InventoryBalance`).
- `GET /scm/stocks/ledger` — read-only движения (из `StockMovement`).

Write paths:
- `PATCH /scm/stocks/*` — **запрещено** (должно возвращать 405).
- `POST /scm/stocks/adjust` — допустимая ручная операция, но внутри должна использовать **каноничный** inventory write-path (orchestrator/FIFO).

## Граница с /inventory
- `/inventory/report/*` — каноничные отчёты/витрины по запасам.
- `/scm/stocks*` — deprecated alias над каноничными источниками (для совместимости).

## Legacy
- Любые документы, описывающие `ScmStock` как SoT, устарели. См. `docs/deprecated/scm-stocks-api.md`.




















