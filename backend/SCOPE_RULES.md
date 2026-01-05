# Operational Scope Rules (C.1)

Цель: избежать “смешивания” данных между странами/брендами/маркетплейсами и сделать multi‑X инварианты явными.

Важно: в текущей схеме **не все сущности имеют brandId/countryId/marketplaceId** как поля. В таких случаях scope **выводится** из связанных сущностей (в первую очередь `Warehouse.countryId`) и enforced в коде.

## Матрица обязательности (по фактическим моделям `schema.prisma`)

| Entity | countryId | brandId | marketplaceId | warehouseId | Примечание |
|---|---:|---:|---:|---:|---|
| **SalesDocument** | ✅ (derive/validate via Warehouse) | ✅ | ✅ | ✅ | Поля в модели optional, но в коде enforced как required для новых документов |
| **SalesDocumentLine** | inherits | inherits | inherits | ✅ (обычно) | scope наследуется от SalesDocument; warehouseId берём из документа/контекста |
| **ScmSupply** | ✅ (через `warehouse.countryId`) | ❌ (нет в модели) | ❌ (нет в модели) | ✅ | Пока scope ограничен страной (warehouse), без brand/marketplace |
| **ScmSupplyItem** | inherits | inherits | inherits | inherits | scope наследуется от supply |
| **ScmTransfer** | ✅ (через обе warehouses; must match) | ❌ (нет в модели) | ❌ (нет в модели) | ✅✅ | from/to warehouses обязаны иметь countryId и совпадать |
| **InventoryAdjustment** | ✅ (через `warehouse.countryId`) | ❌ (нет в модели) | ❌ (нет в модели) | ✅ | enforced в inventory service |
| **InventoryBalance/Transaction/Movement** | inherits | inherits | inherits | ✅ | scope выводится через warehouse/doc; прямых scope‑полей нет |
| **AccountingEntry** | inherits (validate via doc/warehouse) | inherits (только где есть в doc) | inherits (только где есть в doc) | inherits | В модели scope‑полей нет; пока enforced как инварианты совпадения с документом |

## Инварианты

- **SalesDocument** нельзя создать/постить без `warehouseId`, `brandId`, `marketplaceId`.
- `SalesDocument.countryId` должен совпадать с `Warehouse.countryId` (warehouse обязателен).
- **Warehouse** нельзя создать без `countryId`.
- **ScmSupply / InventoryAdjustment** требуют, чтобы `warehouse.countryId` был задан.
- **ScmTransfer** требует, чтобы `fromWarehouse.countryId` и `toWarehouse.countryId` были заданы и совпадали.















