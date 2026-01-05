# Примеры запросов к Analytics Module API

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

### GET /api/analytics/dashboard

Получить данные аналитического дашборда.

**Запрос (за последние 30 дней по умолчанию):**
```bash
curl -X GET http://localhost:3001/api/analytics/dashboard \
  -b cookies.txt
```

**Запрос (с указанием периода):**
```bash
curl -X GET "http://localhost:3001/api/analytics/dashboard?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Ответ:**
```json
{
  "sales": {
    "totalRevenue": 142000,
    "totalOrders": 820,
    "avgCheck": 173.17,
    "totalRefunds": 3200
  },
  "margin": {
    "totalCost": 67000,
    "grossMargin": 72000,
    "grossMarginPercent": 50.7
  },
  "advertising": {
    "totalSpend": 22000,
    "roas": 6.45
  },
  "stocks": {
    "totalSkus": 58,
    "totalQuantity": 12340,
    "lowStockSkus": 7
  },
  "support": {
    "totalReviews": 238,
    "avgRating": 4.3,
    "negativeReviews": 22
  }
}
```

## Описание полей ответа

### sales (Продажи)
- `totalRevenue` — общий доход за период
- `totalOrders` — общее количество заказов (сумма quantity)
- `avgCheck` — средний чек (revenue / orders)
- `totalRefunds` — общая сумма возвратов

**Источник:** таблица `FinanceReport`

### margin (Маржинальность)
- `totalCost` — общая себестоимость (сумма Sku.cost * quantity)
- `grossMargin` — валовая прибыль (revenue - refunds - cost)
- `grossMarginPercent` — процент валовой прибыли (grossMargin / revenue * 100)

**Источник:** таблицы `FinanceReport` и `Sku`

### advertising (Реклама)
- `totalSpend` — общие расходы на рекламу
- `roas` — Return on Ad Spend (revenue / spend)

**Источник:** таблица `AdStats`

### stocks (Остатки)
- `totalSkus` — количество уникальных SKU с остатками
- `totalQuantity` — общее количество товаров на складе
- `lowStockSkus` — количество SKU с низким остатком (< 10 единиц)

**Источник:** таблица `Stock`

### support (Поддержка)
- `totalReviews` — общее количество отзывов за период
- `avgRating` — средний рейтинг
- `negativeReviews` — количество негативных отзывов (рейтинг ≤ 2)

**Источник:** таблица `Review`

## Примеры использования

### Анализ за конкретный месяц
```bash
curl -X GET "http://localhost:3001/api/analytics/dashboard?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

### Анализ за последнюю неделю
```bash
# Установите dateFrom на дату 7 дней назад
curl -X GET "http://localhost:3001/api/analytics/dashboard?dateFrom=2025-01-24&dateTo=2025-01-31" \
  -b cookies.txt
```

### Анализ за весь год
```bash
curl -X GET "http://localhost:3001/api/analytics/dashboard?dateFrom=2025-01-01&dateTo=2025-12-31" \
  -b cookies.txt
```

## Примечания

1. Если параметры `dateFrom` и `dateTo` не указаны, используется период последних 30 дней.
2. Все финансовые значения в валюте системы (рубли).
3. ROAS рассчитывается только если есть данные о расходах на рекламу (spend > 0).
4. Процент валовой прибыли рассчитывается только если есть доход (revenue > 0).



























