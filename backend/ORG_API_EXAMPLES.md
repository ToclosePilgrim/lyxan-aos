# Примеры запросов к OrgModule API

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

### Countries (Страны)

#### GET /api/org/countries
Получить список всех стран.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/org/countries \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "country-id",
    "name": "Russia",
    "code": "RU",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/org/countries/:id
Получить страну по ID с полной информацией.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/org/countries/country-id \
  -b cookies.txt
```

**Ответ:**
```json
{
  "id": "country-id",
  "name": "Russia",
  "code": "RU",
  "brands": [
    {
      "id": "brand-id",
      "name": "Test Brand",
      "code": "TEST_BRAND",
      "marketplaces": [...]
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### POST /api/org/countries
Создать новую страну (только Admin).

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/org/countries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Russia",
    "code": "RU"
  }'
```

**Ответ:**
```json
{
  "id": "country-id",
  "name": "Russia",
  "code": "RU",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### PATCH /api/org/countries/:id
Обновить страну (только Admin).

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/org/countries/country-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Russian Federation"
  }'
```

#### DELETE /api/org/countries/:id
Удалить страну (только Admin).

**Запрос:**
```bash
curl -X DELETE http://localhost:3001/api/org/countries/country-id \
  -b cookies.txt
```

### Brands (Бренды)

#### GET /api/org/brands
Получить список всех брендов.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/org/brands \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "brand-id",
    "name": "Test Brand",
    "code": "TEST_BRAND",
    "countryId": "country-id",
    "country": {
      "id": "country-id",
      "name": "Russia",
      "code": "RU"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/org/brands
Создать новый бренд (только Admin).

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/org/brands \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Brand",
    "code": "TEST_BRAND",
    "countryId": "country-id"
  }'
```

### Marketplaces (Маркетплейсы)

#### GET /api/org/marketplaces
Получить список всех маркетплейсов.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/org/marketplaces \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "marketplace-id",
    "name": "OZON",
    "code": "OZON",
    "brandId": "brand-id",
    "brand": {
      "id": "brand-id",
      "name": "Test Brand",
      "code": "TEST_BRAND",
      "country": {
        "id": "country-id",
        "name": "Russia",
        "code": "RU"
      }
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/org/marketplaces
Создать новый маркетплейс (только Admin).

**Запрос:**
```bash
curl -X POST http://localhost:3001/api/org/marketplaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "OZON",
    "code": "OZON",
    "brandId": "brand-id"
  }'
```

## Ошибки

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Country with ID xxx not found",
  "error": "Not Found"
}
```

### 409 Conflict (дублирующийся код)
```json
{
  "statusCode": 409,
  "message": "Country with code RU already exists",
  "error": "Conflict"
}
```

### 400 Bad Request (попытка удалить связанную запись)
```json
{
  "statusCode": 400,
  "message": "Cannot delete country with ID xxx because it has associated brands",
  "error": "Bad Request"
}
```

### 403 Forbidden (недостаточно прав)
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```



























