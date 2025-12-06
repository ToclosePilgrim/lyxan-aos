# Тестирование AOS

## Patch-4: Автотесты для AOS

Этот документ описывает тестовую инфраструктуру, созданную в Patch-4.

## Структура тестов

### Backend E2E Tests

#### `backend/test/scm.e2e-spec.ts`
Тесты для SCM модуля:
- ✅ Manufacturers (через Suppliers API с фильтром `types=MANUFACTURER`)
- ✅ Warehouses (создание и получение)
- ✅ Supplies (создание и получение)
- ✅ Production Orders (создание и получение)
- ✅ Проверка limit clamp (limit=1000 => результат <=100)
- ✅ Проверка отсутствия 500 ошибок

#### `backend/test/finance.e2e-spec.ts`
Тесты для Finance модуля:
- ✅ Finance Documents CRUD операции
- ✅ Проверка limit clamp
- ✅ Проверка отсутствия 500 ошибок
- ✅ Создание документов с типами SUPPLY и PRODUCTION

### Contract Tests

#### `backend/test/contracts.spec.ts`
Проверка соответствия DTO и Prisma моделей:
- ✅ CreateSupplierDto ↔ Supplier
- ✅ CreateWarehouseDto ↔ Warehouse
- ✅ CreateScmSupplyDto ↔ ScmSupply
- ✅ CreateProductionOrderDto ↔ ProductionOrder
- ✅ CreateFinancialDocumentDto ↔ FinancialDocument

### Frontend Smoke Tests

#### `frontend/tests/smoke.spec.ts`
Smoke тесты для проверки базовой работоспособности UI:
- ✅ Production Orders new page
- ✅ Warehouses new page
- ✅ Supplies new page
- ✅ Finance Documents page
- ✅ Проверка отсутствия ошибок в консоли
- ✅ Проверка отсутствия белого экрана
- ✅ Проверка работы Select компонентов

## Запуск тестов

### Backend

```bash
cd backend

# Unit тесты
npm run test

# Contract тесты
npm run test:contracts

# E2E тесты
npm run test:e2e

# Все тесты
npm run test:all
```

### Frontend

```bash
cd frontend

# Smoke тесты
npm run test:smoke

# Smoke тесты с UI
npm run test:smoke:ui
```

### Из корня проекта

```bash
# Все backend тесты
pnpm test:all

# Frontend smoke тесты
pnpm test:smoke

# Все тесты (backend + frontend)
pnpm test:all && pnpm test:smoke
```

## Что проверяют тесты

### Backend E2E Tests

1. **API не возвращает 500 ошибки** - все эндпоинты должны работать корректно
2. **Limit clamp работает** - запросы с limit=1000 должны возвращать максимум 100 записей
3. **CRUD операции работают** - создание, чтение, обновление, удаление
4. **Валидация работает** - невалидные данные должны возвращать 400/422, а не 500

### Contract Tests

1. **DTO соответствуют Prisma моделям** - все обязательные поля присутствуют
2. **Опциональные поля корректны** - опциональные поля правильно определены
3. **Enum значения поддерживаются** - все значения enum доступны в DTO

### Frontend Smoke Tests

1. **Страницы открываются** - нет белого экрана
2. **Нет ошибок в консоли** - JavaScript ошибки не возникают
3. **Select компоненты работают** - не ломают приложение
4. **Формы загружают данные** - данные подгружаются корректно

## Интеграция с CI/CD

Тесты можно запускать в CI/CD пайплайне:

```yaml
# Пример GitHub Actions
- name: Run Backend Tests
  run: |
    cd backend
    npm run test:all

- name: Run Frontend Smoke Tests
  run: |
    cd frontend
    npm run test:smoke
```

## Требования

- Backend: Node.js, PostgreSQL (для e2e тестов)
- Frontend: Node.js, Playwright
- Все зависимости установлены через `npm install` или `pnpm install`

## Примечания

- E2E тесты требуют запущенной базы данных
- Frontend smoke тесты требуют запущенного dev сервера (автоматически запускается Playwright)
- Тесты очищают тестовые данные после выполнения




