# Примеры запросов к SCM Module API

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

### Products (Товары)

#### GET /api/scm/products
Получить список товаров.

**Запрос:**
```bash
curl -X GET "http://localhost:3001/api/scm/products?page=1&limit=20" \
  -b cookies.txt
```

**Ответ:**
```json
{
  "data": [
    {
      "id": "product-id",
      "name": "Product Name",
      "brand": {
        "id": "brand-id",
        "name": "Test Brand",
        "code": "TEST_BRAND"
      },
      "marketplace": null,
      "totalStock": 100,
      "mainSku": {
        "code": "SKU-001",
        "price": 1000,
        "cost": 500
      },
      "skusCount": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### GET /api/scm/products/:id
Получить товар по ID.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/scm/products/product-id \
  -b cookies.txt
```

#### POST /api/scm/products
Создать новый товар.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/scm/products \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "New Product",
    "brandId": "brand-id",
    "skuCode": "SKU-001",
    "price": 1000,
    "cost": 500
  }'
```

#### PATCH /api/scm/products/:id
Обновить товар.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/scm/products/product-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Product Name"
  }'
```

### Stocks (Остатки)

#### GET /api/scm/stocks
Получить список остатков.

**Запрос:**
```bash
curl -X GET "http://localhost:3001/api/scm/stocks?productId=product-id" \
  -b cookies.txt
```

#### PATCH /api/scm/stocks/:skuId
Обновить остаток.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/scm/stocks/sku-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"quantity": 150}'
```

### Supplies (Поставки)

#### GET /api/scm/supplies
Получить список поставок.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/scm/supplies \
  -b cookies.txt
```

#### POST /api/scm/supplies
Создать новую поставку.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/scm/supplies \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "items": [
      {
        "skuId": "sku-id-1",
        "quantity": 10
      },
      {
        "skuId": "sku-id-2",
        "quantity": 5
      }
    ]
  }'
```

#### PATCH /api/scm/supplies/:id/status
Обновить статус поставки (при RECEIVED автоматически обновляются остатки).

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/scm/supplies/supply-id/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status": "RECEIVED"}'
```






























