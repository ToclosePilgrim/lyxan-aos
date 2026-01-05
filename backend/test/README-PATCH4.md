# Patch-4: Тесты для AOS

## Структура тестов

### Backend E2E Tests

1. **scm.e2e-spec.ts** - Тесты для SCM модуля:
   - Manufacturers (через Suppliers API)
   - Warehouses
   - Supplies
   - Production Orders
   - Проверка limit clamp (limit=1000 => <=100)
   - Проверка отсутствия 500 ошибок

2. **finance.e2e-spec.ts** - Тесты для Finance модуля:
   - Finance Documents CRUD
   - Проверка limit clamp
   - Проверка отсутствия 500 ошибок

### Contract Tests

**contracts.spec.ts** - Проверка соответствия DTO и Prisma моделей:
   - CreateSupplierDto
   - CreateWarehouseDto
   - CreateScmSupplyDto
   - CreateProductionOrderDto
   - CreateFinancialDocumentDto

## Запуск тестов

```bash
# Все unit тесты
npm run test

# Contract тесты
npm run test:contracts

# E2E тесты
npm run test:e2e

# Все тесты
npm run test:all
```

## Frontend Smoke Tests

См. `frontend/tests/smoke.spec.ts` и `frontend/playwright.config.ts`

Запуск:
```bash
cd frontend
npm run test:smoke
```

## Интеграция с Docker

Тесты автоматически запускаются при `docker:up` (если настроено в CI/CD).
























