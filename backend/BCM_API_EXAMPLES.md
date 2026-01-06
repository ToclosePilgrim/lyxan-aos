# Примеры запросов к BCM Module API

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

### Brand (Бренд)

#### GET /api/bcm/brand
Получить информацию о бренде.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/bcm/brand \
  -b cookies.txt
```

**Ответ:**
```json
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
```

#### PATCH /api/bcm/brand
Обновить информацию о бренде.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/bcm/brand \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Brand Name",
    "code": "UPDATED_CODE"
  }'
```

### ProductCard (Карточка товара)

#### GET /api/bcm/products
Получить список товаров с информацией о карточках.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/bcm/products \
  -b cookies.txt
```

**Ответ:**
```json
[
  {
    "id": "product-id",
    "name": "Product Name",
    "brand": {
      "id": "brand-id",
      "name": "Test Brand"
    },
    "marketplace": null,
    "skusCount": 1,
    "cardStatus": "Complete",
    "hasCard": true
  }
]
```

#### GET /api/bcm/products/:id
Получить карточку товара.

**Запрос:**
```bash
curl -X GET http://localhost:3001/api/bcm/products/product-id \
  -b cookies.txt
```

**Ответ:**
```json
{
  "product": {
    "id": "product-id",
    "name": "Product Name",
    "brand": {
      "id": "brand-id",
      "name": "Test Brand"
    },
    "marketplace": null,
    "skus": [...]
  },
  "card": {
    "id": "card-id",
    "productId": "product-id",
    "title": "Product Title",
    "description": "Product description",
    "attributes": {
      "color": "red",
      "size": "M"
    },
    "images": [
      "https://example.com/image1.jpg"
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PATCH /api/bcm/products/:id/card
Создать или обновить карточку товара.

**Запрос:**
```bash
curl -X PATCH http://localhost:3001/api/bcm/products/product-id/card \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Product Title",
    "description": "Product description",
    "attributes": {
      "color": "red",
      "size": "M"
    },
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }'
```






























