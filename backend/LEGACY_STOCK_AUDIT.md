# Legacy Stock Audit (Product/Sku/Stock/Supply/SupplyItem)

## Summary
- Legacy stock models are frozen for writes via feature flag `LEGACY_STOCK_ENABLED` (default expected: false).
- New SCM/Inventory contour (ScmProduct/ScmSupply/Inventory*) is primary; legacy kept only for backward compatibility.
- Writes to legacy models in services are now guarded; legacy endpoints are marked deprecated.

## Legacy usages

### Services / controllers
- `backend/src/modules/scm/scm.service.ts` — READ/WRITE Product, Sku, Stock, Supply; writes guarded by `LEGACY_STOCK_ENABLED`.
- `backend/src/modules/scm/scm.controller.ts` — legacy endpoints (products/stocks/supplies) calling legacy service; all marked `@ApiDeprecated`.
- `backend/src/modules/bcm/bcm.controller.ts` — touches legacy Product via ScmService/BcmService (primarily read, uses legacy DTOs).
- `backend/src/modules/bcm/bcm.service.ts` — READ legacy Product/Sku for listings/cards (no legacy writes).
- `backend/src/modules/bcm/product-content-versions/product-content-versions.service.ts` — READ legacy Product for content versions.
- `backend/src/modules/bcm/listing-versions/listing-versions.service.ts` — READ legacy Product as listing for snapshots.
- `backend/src/modules/analytics/analytics.service.ts` — READ legacy Stock for dashboard metrics (read-only note in code).

### DTOs (legacy-only)
- `backend/src/modules/scm/dto/create-product.dto.ts` — legacy Product/Sku.
- `backend/src/modules/scm/dto/update-product.dto.ts` — legacy Product/Sku.
- `backend/src/modules/scm/dto/ai-update-product-content.dto.ts` — legacy Product content.
- `backend/src/modules/scm/dto/create-supply.dto.ts` — legacy Supply/SupplyItem.
- `backend/src/modules/scm/dto/update-supply-status.dto.ts` — legacy Supply/SupplyItem.

### Writes to legacy models (guarded)
- `createProduct`, `updateProduct`, `deleteProduct` (Product/Sku).
- `updateStock` (Stock).
- `createSupply`, `updateSupplyStatus` (Supply/SupplyItem + Stock updates).

## Next steps
- Remove legacy models/endpoints after migration (Task A.2).
- Migrate remaining reporting/analytics to new Inventory/SCM data.
- Ensure `LEGACY_STOCK_ENABLED` is set to `false` in all environments by default; enable temporarily only if legacy writes are unavoidable.















