# DEPRECATED — Legacy SCM usage (Stock / Supply / SupplyItem)

This document is **deprecated** and does **not** reflect the current architecture.

Canonical truth:
- `docs/architecture/SCM_FINANCE_CANON.md`

---

Original text (kept for history):

# Legacy SCM usage (Stock / Supply / SupplyItem)

## 1. Модели

- Stock — LEGACY
- Supply — LEGACY
- SupplyItem — LEGACY
- Кандидаты на депрекацию: StockBatch / StockMovement / StockReservation (пока используются в новом контуре, проверить перед изменениями).

## 2. Использование в коде

### `backend/src/modules/scm/scm.service.ts`
- `getStocks` — чтение Stock (`findMany`), API `GET /api/scm/stocks`, назначение: внутренняя витрина остатков.
- `updateStock` — upsert Stock, API `PATCH /api/scm/stocks/:skuId`, назначение: ручная правка остатков.
- `getSupplies` — чтение Supply (+ SupplyItem), API `GET /api/scm/supplies`, назначение: список поставок.
- `getSupplyById` — чтение Supply (+ SupplyItem), API `GET /api/scm/supplies/:id`, назначение: карточка поставки.
- `createSupply` — создание Supply/SupplyItem, API `POST /api/scm/supplies`, назначение: регистрация поставки.
- `updateSupplyStatus` — чтение/обновление Supply и обновление Stock, API `PATCH /api/scm/supplies/:id/status`, назначение: приемка поставок.

### `backend/src/modules/scm/scm.controller.ts`
- `GET /scm/stocks` — прокси к legacy Stock (чтение), публичный API SCM.
- `PATCH /scm/stocks/:skuId` — прокси к legacy Stock (создание/обновление), публичный API SCM.
- `GET /scm/supplies` — прокси к legacy Supply/SupplyItem (чтение), публичный API SCM.
- `GET /scm/supplies/:id` — прокси к legacy Supply/SupplyItem (чтение), публичный API SCM.
- `POST /scm/supplies` — прокси к legacy Supply/SupplyItem (создание), публичный API SCM.
- `PATCH /scm/supplies/:id/status` — прокси к legacy Supply/SupplyItem + обновление Stock, публичный API SCM.


