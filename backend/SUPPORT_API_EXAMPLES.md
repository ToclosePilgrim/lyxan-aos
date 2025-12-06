# Примеры запросов к Support Module API

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

### Reviews (Отзывы)

#### GET /api/support/reviews
Получить список отзывов.

**Запрос (все отзывы):**
```bash
curl -X GET http://localhost:3001/api/support/reviews \
  -b cookies.txt
```

**Запрос (с фильтрацией по рейтингу):**
```bash
curl -X GET "http://localhost:3001/api/support/reviews?minRating=4" \
  -b cookies.txt
```

**Запрос (с фильтрацией по SKU и дате):**
```bash
curl -X GET "http://localhost:3001/api/support/reviews?skuId=sku-id&dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "review-id",
    "skuId": "sku-id",
    "rating": 5,
    "text": "Great product!",
    "date": "2025-01-15T00:00:00.000Z",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "sku": {
      "id": "sku-id",
      "code": "SKU-001",
      "product": {
        "id": "product-id",
        "name": "Product Name",
        "brand": {
          "name": "Brand Name"
        }
      }
    }
  }
]
```

#### POST /api/support/reviews
Создать отзыв (для тестирования).

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/support/reviews \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id",
    "rating": 5,
    "text": "Great product!",
    "date": "2025-01-15"
  }'
```

### Support Tickets (Тикеты)

#### GET /api/support/tickets
Получить список тикетов.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/support/tickets \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "ticket-id",
    "text": "Product quality issue\n\nCustomer reported quality issues with the product.",
    "status": "NEW",
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-15T00:00:00.000Z"
  }
]
```

#### GET /api/support/tickets/:id
Получить тикет по ID.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/support/tickets/ticket-id \
  -b cookies.txt
```

**Ответ:**
```json
{
  "id": "ticket-id",
  "title": "Product quality issue",
  "body": "Customer reported quality issues with the product.",
  "text": "Product quality issue\n\nCustomer reported quality issues with the product.",
  "status": "NEW",
  "createdAt": "2025-01-15T00:00:00.000Z",
  "updatedAt": "2025-01-15T00:00:00.000Z"
}
```

#### POST /api/support/tickets
Создать тикет.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/support/tickets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Product quality issue",
    "text": "Customer reported quality issues with the product."
  }'
```

#### PATCH /api/support/tickets/:id/status
Обновить статус тикета.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/support/tickets/ticket-id/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

## Примеры тестовых данных

### Создание отзывов

```bash
# Отзыв 1
curl -X POST http://localhost:3001/api/support/reviews \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id-1",
    "rating": 5,
    "text": "Excellent product, very satisfied!",
    "date": "2025-01-15"
  }'

# Отзыв 2
curl -X POST http://localhost:3001/api/support/reviews \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "skuId": "sku-id-2",
    "rating": 3,
    "text": "Average quality, could be better",
    "date": "2025-01-16"
  }'
```

### Создание тикета и обновление статуса

```bash
# 1. Создать тикет
curl -X POST http://localhost:3001/api/support/tickets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Product delivery delay",
    "text": "Customer complains about delayed delivery of order #12345"
  }'

# 2. Обновить статус
curl -X PATCH http://localhost:3001/api/support/tickets/ticket-id/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "IN_PROGRESS"
  }'

# 3. Закрыть тикет
curl -X PATCH http://localhost:3001/api/support/tickets/ticket-id/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "RESOLVED"
  }'
```







