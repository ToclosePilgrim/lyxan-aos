# Примеры запросов к Finance Module API

## Предварительные условия

1. Убедитесь, что backend запущен: `pnpm run start:dev`
2. Выполните вход и сохраните cookies:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aos.local","password":"ChangeMe123!"}' \
  -c cookies.txt
```

## Примеры запросов

### Finance Reports (Финансовые отчёты)

#### GET /api/finance/reports
Получить список финансовых отчётов.

**Запрос (все отчёты):**
```bash
curl -X GET http://localhost:3001/api/finance/reports \
  -b cookies.txt
```

**Запрос (с фильтрацией по дате):**
```bash
curl -X GET "http://localhost:3001/api/finance/reports?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Запрос (с фильтрацией по SKU):**
```bash
curl -X GET "http://localhost:3001/api/finance/reports?skuId=sku-id" \
  -b cookies.txt
```

**Ответ:**
```json
{
  "data": [
    {
      "id": "report-id",
      "skuId": "sku-id",
      "date": "2025-01-15T00:00:00.000Z",
      "quantity": 10,
      "revenue": 10000,
      "commission": 1500,
      "refunds": 500,
      "createdAt": "2025-01-15T12:00:00.000Z",
      "sku": {
        "id": "sku-id",
        "code": "SKU-001",
        "product": {
          "name": "Product Name",
          "brand": {
            "name": "Brand Name"
          }
        }
      }
    }
  ],
  "total": 1,
  "limit": null,
  "offset": null
}
```

#### POST /api/finance/reports
Создать финансовый отчёт.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/finance/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id",
    "date": "2025-01-15",
    "quantity": 10,
    "revenue": 10000,
    "commission": 1500,
    "refunds": 500
  }'
```

**Минимальный запрос (commission и refunds опциональны):**
```bash
curl -X POST http://localhost:3001/api/finance/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id",
    "date": "2025-01-15",
    "quantity": 10,
    "revenue": 10000
  }'
```

### P&L (Profit & Loss)

#### GET /api/finance/pnl
Получить P&L отчёт.

**Запрос (за весь период):**
```bash
curl -X GET http://localhost:3001/api/finance/pnl \
  -b cookies.txt
```

**Запрос (за период):**
```bash
curl -X GET "http://localhost:3001/api/finance/pnl?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Ответ:**
```json
{
  "totalRevenue": 100000,
  "totalCommission": 15000,
  "totalRefunds": 5000,
  "totalCost": 50000,
  "grossMargin": 30000,
  "grossMarginPercent": 30.0,
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-31"
}
```

## Примеры тестовых данных

### Создание нескольких финансовых строк

```bash
# Строка 1
curl -X POST http://localhost:3001/api/finance/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id-1",
    "date": "2025-01-15",
    "quantity": 10,
    "revenue": 10000,
    "commission": 1500,
    "refunds": 500
  }'

# Строка 2
curl -X POST http://localhost:3001/api/finance/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id-2",
    "date": "2025-01-16",
    "quantity": 5,
    "revenue": 5000,
    "commission": 750,
    "refunds": 0
  }'

# Строка 3
curl -X POST http://localhost:3001/api/finance/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id-1",
    "date": "2025-01-17",
    "quantity": 8,
    "revenue": 8000,
    "commission": 1200,
    "refunds": 200
  }'
```

### Проверка P&L за январь 2025

```bash
curl -X GET "http://localhost:3001/api/finance/pnl?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```







