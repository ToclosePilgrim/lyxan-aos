# Примеры запросов к Advertising Module API

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

### AdCampaign (Кампании)

#### GET /api/advertising/campaigns
Получить список кампаний.

**Запрос (все кампании):**
```bash
curl -X GET http://localhost:3001/api/advertising/campaigns \
  -b cookies.txt
```

**Запрос (с фильтрацией по статусу):**
```bash
curl -X GET "http://localhost:3001/api/advertising/campaigns?status=ACTIVE" \
  -b cookies.txt
```

**Запрос (с поиском по названию):**
```bash
curl -X GET "http://localhost:3001/api/advertising/campaigns?search=Summer" \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "campaign-id",
    "name": "Summer Sale Campaign",
    "status": "ACTIVE",
    "budget": 100000,
    "marketplace": {
      "id": "marketplace-id",
      "name": "OZON",
      "code": "OZON"
    },
    "totalSpend": 5000,
    "totalRevenue": 50000,
    "totalOrders": 50,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/advertising/campaigns/:id
Получить кампанию по ID.

**Запрос:**
```bash
curl -X GET "http://localhost:3001/api/advertising/campaigns/campaign-id?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Ответ:**
```json
{
  "id": "campaign-id",
  "name": "Summer Sale Campaign",
  "status": "ACTIVE",
  "budget": 100000,
  "marketplace": {
    "id": "marketplace-id",
    "name": "OZON",
    "code": "OZON"
  },
  "stats": [
    {
      "id": "stat-id",
      "campaignId": "campaign-id",
      "date": "2025-01-15T00:00:00.000Z",
      "impressions": 10000,
      "clicks": 500,
      "spend": 5000,
      "orders": 50,
      "revenue": 50000,
      "createdAt": "2025-01-15T12:00:00.000Z"
    }
  ],
  "aggregates": {
    "totalSpend": 5000,
    "totalRevenue": 50000,
    "totalOrders": 50,
    "roas": 10.0
  }
}
```

#### POST /api/advertising/campaigns
Создать кампанию.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/advertising/campaigns \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "marketplaceId": "marketplace-id",
    "name": "Summer Sale Campaign",
    "status": "ACTIVE",
    "budget": 100000
  }'
```

#### PATCH /api/advertising/campaigns/:id
Обновить кампанию.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/advertising/campaigns/campaign-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "PAUSED",
    "budget": 150000
  }'
```

#### DELETE /api/advertising/campaigns/:id
Удалить кампанию.

**Запрос:**
```bash
curl -X DELETE http://localhost:3001/api/advertising/campaigns/campaign-id \
  -b cookies.txt
```

### AdStats (Статистика)

#### POST /api/advertising/stats
Создать статистику.

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/advertising/stats \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "campaignId": "campaign-id",
    "date": "2025-01-15",
    "impressions": 10000,
    "clicks": 500,
    "spend": 5000,
    "orders": 50,
    "revenue": 50000
  }'
```

**Минимальный запрос (все поля опциональны, кроме campaignId и date):**
```bash
curl -X POST http://localhost:3001/api/advertising/stats \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "campaignId": "campaign-id",
    "date": "2025-01-15",
    "spend": 5000,
    "revenue": 50000
  }'
```

#### PATCH /api/advertising/stats/:id
Обновить статистику.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/advertising/stats/stat-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "impressions": 12000,
    "clicks": 600,
    "spend": 6000
  }'
```

#### DELETE /api/advertising/stats/:id
Удалить статистику.

**Запрос:**
```bash
curl -X DELETE http://localhost:3001/api/advertising/stats/stat-id \
  -b cookies.txt
```

## Примеры тестовых данных

### Создание кампании и добавление статистики

```bash
# 1. Создать кампанию
curl -X POST http://localhost:3001/api/advertising/campaigns \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "marketplaceId": "marketplace-id",
    "name": "Test Campaign",
    "status": "ACTIVE",
    "budget": 100000
  }'

# 2. Добавить статистику за день 1
curl -X POST http://localhost:3001/api/advertising/stats \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "campaignId": "campaign-id",
    "date": "2025-01-15",
    "impressions": 10000,
    "clicks": 500,
    "spend": 5000,
    "orders": 50,
    "revenue": 50000
  }'

# 3. Добавить статистику за день 2
curl -X POST http://localhost:3001/api/advertising/stats \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "campaignId": "campaign-id",
    "date": "2025-01-16",
    "impressions": 12000,
    "clicks": 600,
    "spend": 6000,
    "orders": 60,
    "revenue": 60000
  }'

# 4. Получить детальную информацию о кампании
curl -X GET "http://localhost:3001/api/advertising/campaigns/campaign-id" \
  -b cookies.txt
```



























