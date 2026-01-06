# OrgModule - Быстрый старт

## Структура API

### Countries
- `GET /api/org/countries` - список стран
- `GET /api/org/countries/:id` - детали страны
- `POST /api/org/countries` - создать (Admin)
- `PATCH /api/org/countries/:id` - обновить (Admin)
- `DELETE /api/org/countries/:id` - удалить (Admin)

### Brands
- `GET /api/org/brands` - список брендов
- `GET /api/org/brands/:id` - детали бренда
- `POST /api/org/brands` - создать (Admin)
- `PATCH /api/org/brands/:id` - обновить (Admin)
- `DELETE /api/org/brands/:id` - удалить (Admin)

### Marketplaces
- `GET /api/org/marketplaces` - список маркетплейсов
- `GET /api/org/marketplaces/:id` - детали маркетплейса
- `POST /api/org/marketplaces` - создать (Admin)
- `PATCH /api/org/marketplaces/:id` - обновить (Admin)
- `DELETE /api/org/marketplaces/:id` - удалить (Admin)

## Быстрая проверка

```bash
# 1. Вход
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aos.local","password":"ChangeMe123!"}' \
  -c cookies.txt

# 2. Получить страны
curl http://localhost:3001/api/org/countries -b cookies.txt

# 3. Получить бренды
curl http://localhost:3001/api/org/brands -b cookies.txt

# 4. Получить маркетплейсы
curl http://localhost:3001/api/org/marketplaces -b cookies.txt
```

## Swagger

Документация доступна: http://localhost:3001/api/docs






























