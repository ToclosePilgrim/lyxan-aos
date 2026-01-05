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

### `backend/src/modules/analytics/analytics.service.ts`
- `getDashboard` — чтение Stock (`findMany`) для агрегатов, контекст: внутренняя аналитика/дашборд.

### Stocks — канонические эндпоинты
- `backend/src/modules/scm/stocks/scm-stocks.controller.ts` — CANONICAL `/scm/stocks`, `/scm/stocks/summary`, `/scm/stocks/batches`, `/scm/stocks/ledger`, `/scm/stocks/adjust`, `/scm/stocks/recalculate`. Используют ScmStock/stockMovement/stockBatch/FIFO.
- Старые методы `/scm/stocks` в `scm.controller.ts` — LEGACY, подлежат удалению после миграции; фронт не должен на них опираться.

## 3. Тесты/Сиды

- `backend/test/scm.e2e-spec.ts` — раздел `LEGACY Supplies (Stock/Supply/SupplyItem)`: e2e старых эндпоинтов `/api/scm/supplies`, опирается на legacy модели.
- `backend/test/scm.e2e-spec.ts` — cleanup через `prisma.supply.deleteMany` для созданных данных.
- `backend/test/scm-bcm-link.e2e-spec.ts` — cleanup через `prisma.stock.deleteMany`, контекст: e2e связки SCM↔BCM.
- Seeds/scripts: не обнаружены использования Stock/Supply/SupplyItem.

## 4. Решение

- Новые фичи и правки **не используют** Stock/Supply/SupplyItem.
- Дальнейшие ТЗ заменят их на: ScmSupply + InventoryBalance/InventoryTransaction + ScmStock + stockBatch/stockMovement.

