# Inventory Write Audit (B.2)

Цель: убедиться, что **write-операции** по моделям:

- `InventoryBalance`
- `StockMovement`
- `InventoryTransaction`
- `InventoryAccountingLink`
- `StockReservation`
- `InventoryAdjustment`

встречаются **только** в `backend/src/modules/inventory/**` (через `InventoryService` / `InventoryOrchestratorService` и дружественные сервисы inventory-модуля).

## Найденные write-операции ВНЕ `inventory/**` (нужно исправить)

### 1) `backend/src/modules/scm/stocks/stock-reservation.service.ts`
- **Модель**: `StockReservation`
- **Операции**: `create`, `update`, `delete`, `deleteMany`
- **Причина**: сервис резерваций живёт в SCM и пишет напрямую в `prisma.stockReservation.*`
- **Что заменить**:
  - вынести write-реализацию в `backend/src/modules/inventory/stock-reservation.service.ts`
  - SCM/Production должны только вызывать методы inventory-сервиса (read разрешён)

### 2) `backend/src/modules/scm/stocks/scm-stocks.service.ts`
- **Модель**: `InventoryAdjustment`
- **Операции**: `create`
- **Причина**: корректировка остатков создаёт запись `InventoryAdjustment` напрямую из SCM
- **Что заменить**:
  - создать метод/сервис в inventory-модуле (например `InventoryAdjustmentsService.createAdjustment(...)`)
  - SCM вызывает inventory-метод, а не `prisma.inventoryAdjustment.create`

### 3) `backend/src/modules/finance/inventory-accounting-link.service.ts`
- **Модель**: `InventoryAccountingLink`
- **Операции**: `create`
- **Причина**: линковка “движение ↔ проводка” пишет в `tx.inventoryAccountingLink.create` из finance слоя
- **Что заменить**:
  - вынести write-операцию в inventory слой (например `InventoryAccountingLinkWriterService`)
  - finance сервис может делать read (findMany) и делегировать write в inventory writer

## Write-операции В `inventory/**` (ОК)

Это допустимо и ожидаемо (ядро):

- `backend/src/modules/inventory/inventory.service.ts`
  - `inventoryBalance.create/update`
  - `inventoryTransaction.create`
- `backend/src/modules/inventory/fifo.service.ts`
  - `stockBatch.create/update`
  - `stockMovement.create`
- `backend/src/modules/inventory/inventory-orchestrator.service.ts`
  - `inventoryTransaction.create`
  - `stockMovement.update`

## TODO

- После рефакторинга повторить grep по repo и убедиться, что **вне `inventory/**` нет**:
  - `.inventoryBalance.(create|update|upsert|delete|deleteMany)`
  - `.stockMovement.(create|update|upsert|delete|deleteMany)`
  - `.inventoryTransaction.(create|update|upsert|delete|deleteMany)`
  - `.inventoryAccountingLink.(create|update|upsert|delete|deleteMany)`
  - `.stockReservation.(create|update|upsert|delete|deleteMany)`
  - `.inventoryAdjustment.(create|update|upsert|delete|deleteMany)`















