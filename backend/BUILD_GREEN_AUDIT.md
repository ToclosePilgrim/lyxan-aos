## BUILD_GREEN_AUDIT (E.1) — DONE ✅

Логи прогонов:

- `backend/BUILD_GREEN_BUILD.log` (initial, FAIL)
- `backend/BUILD_GREEN_BUILD_2.log` (after analytics/bcm/org, FAIL)
- `backend/BUILD_GREEN_BUILD_3.log` (after OS fixes, FAIL)
- `backend/BUILD_GREEN_BUILD_4.log` (final, PASS ✅)

### Analytics
- `src/modules/analytics/analytics.service.ts:190`
  - **TS2339**: `Prisma.sql.array` не существует
  - **Действие**: заменить на корректный `Prisma.sql`/`Prisma.join`/`Prisma.raw` для `ANY(...)`

### BCM
- `src/modules/bcm/bcm.service.ts:41,54,58`
  - **TS2353/TS2339**: использовались legacy relations `brand._count.products`, `brand.countries`, `include: { products }`
  - **Действие**: переписать на новые relations (`scmProducts`, `bcmListings`, `BrandCountry`) или убрать поле из ответа
- `src/modules/bcm/bcm.service.ts:360-370`
  - **TS2322**: `Record<string, unknown>` не подходит для Prisma Json input
  - **Действие**: типизировать JSON как `Prisma.InputJsonValue` / `Prisma.JsonObject` и приводить безопасно

### Org
- `src/modules/org/org.service.ts:325,333,476,484`
  - **TS2353/TS2339**: legacy `products` на `Brand`/`Marketplace`
  - **Действие**: убрать include/products и переписать проверки на новые источники (`scmProducts`, `bcmListings`)

### OS / Registry
- `src/modules/os-registry/os-registry.controller.ts:16,27,39`
  - **TS2314**: `OsApiResponse<T>` требует generic аргумент
  - **Действие**: проставить корректные `OsApiResponse<...>`
- `src/modules/os/os-router.controller.ts:17`, `src/modules/os/os-router.service.ts:17`
  - **TS2314**: `OsApiResponse<T>` требует generic аргумент
  - **Действие**: проставить `OsApiResponse<...>`
- `src/modules/os/os-finance.controller.ts:43`
  - **TS2339**: `financialDocs.list` отсутствует
  - **Действие**: заменить на существующий метод (`listDocuments`/`listForOs`/`getList`) или добавить типизированный метод в сервис
- `src/modules/os/os-scm.controller.ts:38-39`
  - **TS2339**: код ожидает `{items|data|total|pagination}`, но сервис возвращает массив
  - **Действие**: типизировать ответы и убрать “универсальный” доступ к `.items/.data`
- `src/modules/os/os-service-map.ts`
  - **TS2300/TS2451**: дубли импортов/константы
  - **Действие**: удалить дубли, оставить один `OS_SERVICE_MAP`, типизировать map

### SCM / Production Orders
- `src/modules/scm/production-orders/production-orders.service.ts`
  - **TS2393**: duplicate function implementation (`getCostBreakdown` объявлен дважды)
  - **TS2339**: `dto.currency` отсутствует в `UpdateProductionOrderDto`
  - **TS2339/TS2551**: mismatch структуры breakdown (`materials/services` vs `material/service`, отсутствуют `currency`, `totalCost`, `productionOrderId`, `orderUnit`)
  - **Действие**: удалить дубликат, выровнять DTO и тип результата cost breakdown (единый интерфейс)

## Итог

`pnpm --filter backend build` проходит без ошибок ✅

# BUILD_GREEN_AUDIT (E.1)

## Goal

Make `pnpm --filter backend build` pass with **0 TypeScript errors**.

## Source of truth

- Build log: `backend/BUILD_GREEN_BUILD_LOG.txt`
- Current error count (first run): **116**

## Error grouping by module (from build log)

### analytics

- `src/modules/analytics/analytics.service.ts`
  - `TS2339`: `Prisma.sql.array(...)` does not exist → rewrite raw SQL `ANY(...)` to use supported Prisma helpers.

### bcm

- `src/modules/bcm/bcm.service.ts`
  - `TS2353/TS2339`: references removed legacy relations (`Brand.products`, `Brand.countries`, `_count.products`) → refactor to ScmProduct/BCM v2 tables.
  - `TS2322`: `Record<string, unknown>` not assignable to Prisma JSON input → normalize to `Prisma.InputJsonValue` (no `any`).

### finance

- `src/modules/finance/accounting-entry/accounting-entry-scope.ts`
  - uses legacy `product`/missing `warehouse/items` selects in `scmSupply` queries → migrate to `scmProduct` + proper includes.
- `src/modules/finance/currency-rates/errors.ts`
  - `TS2307`: missing `date-fns` → remove dependency or add package (prefer remove for minimal surface).
- `src/modules/finance/documents/financial-documents.service.ts`
  - `paidAt` field doesn’t exist (use `date`)
  - `amountTotal/amountPaid` type mismatch due to Prisma update ops → normalize numeric/Decimal types.
- `src/modules/finance/finance.service.ts`
  - `includes(e.debitAccount/creditAccount)` fails due to overly-narrow literal types in `PNL_ACCOUNT_GROUPS` → widen to `readonly string[]` or refine entry types.
- `src/modules/finance/ledger-aggregate.service.ts`
  - wrong import path to `PrismaService`
- `src/modules/finance/overhead-rules/overhead-rules.service.ts`
  - `never[]` inference in `lines.push(...)` → add explicit line type.
- `src/modules/finance/sales-documents/sales-documents.service.ts`
  - `FinancialDocument` create/update uses nonexistent `docType` field → remove/replace with existing fields.

### inventory

- `src/modules/inventory/inventory-report.service.ts`
  - uses `productId`/`supplyItem.productId` and expects `warehouse` relation without include → update to `scmProductId` + correct includes.
- `src/modules/inventory/inventory.service.ts`
  - `include.product` no longer exists → use `include.scmProduct`.

### scm

- `src/modules/scm/supplies/scm-supplies.service.ts`
  - still includes `product` and expects `financialDocuments/items/receipts` without include; wrong status typing; missing `canTransition` method.
- `src/modules/scm/scm-products.service.ts`
  - references removed relation `ScmProduct.products` and missing `brand` include / `_count` handling.
- `src/modules/scm/production-orders/production-orders.service.ts`
  - multiple issues: `never[]` inference, missing account constant, legacy field names (`quantityReceived`), duplicate methods, DTO mismatch (`currency`), response shape mismatch (`material` vs `materials`, etc.).

### os / registry

- `src/modules/os-registry/os-registry.controller.ts`
  - `OsApiResponse<T>` generic used without type argument.
- `src/modules/os/os-router.*`
  - same `OsApiResponse<T>` generic issue.
- `src/modules/os/os-finance.controller.ts`
  - calls `FinancialDocumentsService.list()` which does not exist → update to current API.
- `src/modules/os/os-scm.controller.ts`
  - assumes list response wrapper (`items/data/total/pagination`) but actual service returns array → fix typing/adapter.
- `src/modules/os/os-service-map.ts`
  - duplicate imports / duplicate `OS_SERVICE_MAP` declarations → dedupe or delete dead file.

### org

- `src/modules/org/org.service.ts`
  - references removed relations `Brand.products` / `Marketplace.products` → migrate to ScmProduct/BCM v2 equivalents or remove dead code paths.

## Execution order (strict)

1) finance (core correctness + many transitive deps)
2) inventory
3) scm
4) analytics + bcm + org
5) os / registry

## Done criteria

- `pnpm --filter backend build` ✅
- no `@ts-ignore`, no “add any to pass build”, no strict downgrade


