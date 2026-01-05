# LEGACY_DELETE_AUDIT (A.2-final)

## Цель

Полностью удалить из проекта:

- Prisma модели: `Product`, `Sku`, `Stock`, `Supply`, `SupplyItem`
- `FinanceReport`
- весь код, который читает/пишет эти модели (`prisma.product/sku/stock/supply/supplyItem/financeReport`)

## Prisma schema: что удаляем

В `backend/prisma/schema.prisma` присутствуют:

- `model Product`
- `model Sku`
- `model Stock`
- `model Supply`
- `model SupplyItem`
- `model FinanceReport`

Также есть множество relations в других моделях на `Product/Sku/Stock/...` (требует зачистки/замены).

## Backend code: текущие использования (grep summary)

### FinanceReport

- `backend/src/modules/finance/sales-documents/sales-documents.service.ts`
  - `this.prisma.financeReport.findMany(...)` (импорт SalesDocument из FinanceReport)
- `backend/src/modules/finance/finance.service.ts`
  - `createReport(...)` (создание FinanceReport)
- `backend/src/modules/finance/finance.controller.ts`
  - endpoint для создания FinanceReport
- `backend/src/modules/finance/dto/create-finance-report.dto.ts`
- `backend/src/modules/finance/sales-documents/dto/import-from-finance-report.dto.ts`
- `backend/src/modules/finance/sales-documents/sales-documents.controller.ts`
  - endpoint `importFromReports`

**Действие**: удалить модель `FinanceReport`, удалить DTO/endpoint/service код импорта и создания отчётов.

### Legacy SCM module (product/sku/stock/supply)

- `backend/src/modules/scm/scm.service.ts`
  - массовые вызовы `prisma.product/sku/stock/supply/supplyItem`
  - содержит legacy endpoints и пишет в legacy таблицы

**Действие**: удалить/отключить legacy `ScmService` и legacy контроллер `scm.controller.ts` + DTO `create-product/update-product/create-supply/update-supply-status` (если они завязаны на legacy модели).

### SalesDocumentLine legacy поля/fallback

- `backend/prisma/schema.prisma`:
  - `SalesDocumentLine.skuId`, `SalesDocumentLine.productId` (legacy)
  - `SalesDocumentLine.itemId` уже есть, и `scmProductId` уже есть
- `backend/src/modules/finance/sales-documents/sales-documents.service.ts`
  - было/есть использование `line.productId`, `line.skuId` как fallback (должно быть убрано)

**Действие**: сделать `SalesDocumentLine.scmProductId` обязательным на import/create; убрать поля `skuId/productId` из схемы или оставить только как legacy? (ТЗ просит hard delete → убрать).

### InventoryBalance legacy productId

- `backend/prisma/schema.prisma`:
  - `InventoryBalance.productId -> Product`
  - `InventoryTransaction.productId -> Product`

**Действие**: заменить `productId` на `scmProductId` (FK → `ScmProduct`) или перейти на единый `itemId` без FK.
Для A.2-final предпочтение: `InventoryBalance.scmProductId` + `supplierItemId` (оба optional) и убрать `productId`.

### BCM legacy note

- `backend/src/modules/bcm/bcm.controller.ts` содержит legacy note в комментарии (не использование).

**Действие**: оставить/почистить комментарий (не критично), главное — убрать реальные imports/calls.

## План замены (high-level)

1) Удаляем `FinanceReport` и все импорты/эндпоинты вокруг него.
2) Убираем legacy SCM API (`ScmService` / legacy product/stock/supply endpoints).
3) Переводим `SalesDocumentLine` на SSOT: `scmProductId` (+ `supplierItemId` если нужно) и удаляем `skuId/productId`.
4) Переводим `InventoryBalance/InventoryTransaction` на `scmProductId` вместо `productId` и удаляем legacy FK.
5) Canonical миграция drop’а таблиц + финальный grep gate.














