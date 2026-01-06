# Inventory Report API (canonical read-models)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

## Эндпоинты
- `GET /inventory/report/balances`
  - query: `warehouseId?`, `itemId?`, `page?`, `pageSize?`
  - Возвращает агрегированные остатки по склад+item на основе `InventoryBalance` (read-model).
- `GET /inventory/report/movements`
  - query: `warehouseId` (обяз. для non-superadmin), `itemId?`, `dateFrom?`, `dateTo?`, `movementType?`, `docType?`, `page?`, `pageSize?`
  - Возвращает движения `StockMovement` (ledger движений склада). Для multi-batch операций OUT возвращается N движений (по партиям).

## DTO (ключевые поля)
- Balances: `warehouseId`, `itemId`, `quantity` (+ поля витрины по реализации сервиса).
- Movements: `movementId`, `warehouseId`, `itemId`, `occurredAt`, `movementType`, `quantity`, `docType/docId`, `batchId?`, `inventoryTransactionId?`.

## Назначение
- Balances — оперативная картина запасов.
- Movements — расследование движений, связь со складом и бухгалтерией.

## Scope / безопасность
- Все чтения должны быть защищены scope-правилами (tenant isolation).
- Для non-superadmin может требоваться `warehouseId` (fail-closed), если legalEntityId нельзя вывести напрямую из модели.




















