# ANALYTICS_REFACTOR_AUDIT (D.2)

## Цель

Перевести `backend/src/modules/analytics/**` на источники:

- `AccountingEntry` (выручка/COGS/fees/refunds и агрегаты P&L)
- `InventoryBalance` (остатки on-hand)
- `ScmProduct` (топ товары / справочник)
- (опционально) `BcmProductContent` для `title` по `countryId+lang`

И полностью убрать зависимости от:

- legacy `Stock` / `Product` / `Sku`
- `FinanceReport`
- прочих “RAW/legacy” источников внутри analytics

## Текущее состояние (до D.2)

| Endpoint | Файл | Текущий источник | Проблема | Замена (D.2) |
|---|---|---|---|---|
| `GET /analytics/dashboard` | `backend/src/modules/analytics/analytics.service.ts` | `FinanceReport`, legacy `Stock`, `AdStats`, `Review` | не SSOT, не scoped, legacy | `AccountingEntry` (P&L агрегаты) + `InventoryBalance` (остатки). `AdStats/Review` — убрать из v2 (или отдельный модуль позже). |

## Новые endpoints (D.2 v2)

| Endpoint | Источник | Scope |
|---|---|---|
| `GET /analytics/dashboard` | `AccountingEntry` | `countryId`, `brandId`, опц. `marketplaceId` |
| `GET /analytics/inventory-snapshot` | `InventoryBalance` | `countryId`, `brandId` |
| `GET /analytics/top-products` | `AccountingEntry` (если есть разрез по product в metadata) + `ScmProduct` (+опц `BcmProductContent`) | `countryId`, `brandId`, опц. `marketplaceId` |

## Маппинг метрик (AccountingEntry → KPI)

Используем `backend/src/modules/finance/pnl-account-groups.ts`:

- revenue: `PNL_ACCOUNT_GROUPS.REVENUE` по `creditAccount`
- cogs: `PNL_ACCOUNT_GROUPS.COGS` по `debitAccount`
- fees: `PNL_ACCOUNT_GROUPS.MARKETPLACE_FEES` по `debitAccount`
- refunds: `PNL_ACCOUNT_GROUPS.REFUNDS` по `debitAccount`
- grossProfit = revenue - cogs - fees - refunds

## Notes / assumptions

- Все запросы analytics v2 **строго scoped** (как в C.1/C.3): `countryId + brandId` обязательны.
- `TopProducts`: если в `AccountingEntry.metadata` нет `scmProductId/itemId`, то endpoint вернёт пустой список и запишет это как ограничение (до добавления product-dimension в проводки).















