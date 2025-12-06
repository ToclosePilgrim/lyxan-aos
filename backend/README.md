# Ly[x]an AOS Backend

Backend для Ly[x]an AOS — Agentic Operating System для управления e-commerce.

## Технологический стек

- **NestJS** — прогрессивный Node.js фреймворк
- **Prisma** — ORM для работы с базой данных
- **PostgreSQL** — реляционная база данных
- **Redis** — кэширование и сессии
- **TypeScript** — типизированный JavaScript

## Структура backend

```
backend/
├── src/
│   ├── modules/          # Бизнес-модули AOS
│   │   ├── auth/
│   │   ├── users/
│   │   ├── org/
│   │   ├── scm/
│   │   ├── bcm/
│   │   ├── finance/
│   │   ├── advertising/
│   │   ├── support/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── agents/
│   ├── common/           # Общая инфраструктура
│   │   ├── filters/      # Фильтры исключений
│   │   ├── guards/       # Guards для авторизации
│   │   ├── interceptors/ # Интерцепторы (логирование)
│   │   └── decorators/   # Кастомные декораторы
│   ├── config/           # Конфигурация
│   ├── database/         # Prisma и Redis сервисы
│   ├── app.module.ts     # Корневой модуль
│   └── main.ts           # Точка входа
├── prisma/
│   └── schema.prisma     # Схема базы данных
├── .env.example          # Пример переменных окружения
└── package.json
```

## Установка

```bash
# Из корня монорепозитория
pnpm install

# Или из директории backend
cd backend
pnpm install
```

## Настройка переменных окружения

### ENV файлы

Backend может читать переменные окружения из двух мест:

1. **`backend/.env`** — локальный файл для разработки (приоритет)
2. **`.env`** (в корне проекта) — общий файл, используется Docker'ом

При запуске backend командой `pnpm -F backend start:dev`:
- Если `.env` лежит в `backend/` → используются переменные из него
- Если `.env` лежит в корне проекта → переменные подхватываются через `../.env`
- В Docker используется корневой `.env` через `env_file: ../.env`

**Рекомендация:** Для локальной разработки используйте корневой `.env` (он уже настроен для Docker).

1. Скопируйте `.env.example` в `.env` (в корне проекта):
```bash
cp .env.example .env
```

2. Отредактируйте `.env` и укажите ваши настройки:
```env
# Используйте креденшалы из docker-compose.yml: aos/aos/aosdb
# Порт 5433 - внешний порт контейнера (проброшен из 5432)
DATABASE_URL="postgresql://aos:aos@localhost:5433/aosdb?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
PORT=3001
```

## Запуск приложения

### Режим разработки (с hot-reload)
```bash
pnpm -F backend start:dev
# или из директории backend
pnpm run start:dev
```

### Production режим
```bash
pnpm -F backend build
pnpm -F backend start:prod
```

### Обычный запуск
```bash
pnpm -F backend start
```

Приложение будет доступно по адресу: `http://localhost:3001/api`

## Работа с Prisma

### Local DB / Prisma Setup

#### Проверка и запуск Postgres

**Настройки Postgres в docker-compose.yml:**
- **User:** `aos`
- **Password:** `aos`
- **Database:** `aosdb`
- **Внешний порт:** `5433` (проброшен из внутреннего `5432`)

**Полностью пересоздать базу данных:**

Если нужно начать с чистой БД (например, после изменения схемы или при ошибках подключения):

```bash
cd infra
docker compose down -v
docker rm aos-postgres || true
docker compose up -d postgres
```

Команда `docker compose down -v` удалит все volumes, включая данные БД.

#### Установка правильного DATABASE_URL

**Для локальной разработки (`backend/.env`):**

```env
DATABASE_URL="postgresql://aos:aos@localhost:5433/aosdb?schema=public"
```

**Для Docker (автоматически в `docker-compose.yml`):**

```env
DATABASE_URL="postgresql://aos:aos@postgres:5432/aosdb?schema=public"
```

**Важно:**
- **Локально:** используйте порт `5433` (внешний порт контейнера) и хост `localhost`
- **В Docker:** используйте порт `5432` (внутренний порт) и имя сервиса `postgres` (Docker network)
- Креденшалы должны совпадать с настройками в `docker-compose.yml`: `aos/aos/aosdb`

#### Применение миграций

**Первоначальная миграция:**

```bash
# 1. Убедитесь, что PostgreSQL запущен
cd infra
docker compose up -d postgres

# 2. Выполните начальную миграцию из папки backend
cd ../backend
pnpm exec prisma migrate dev --name init
```

**Ожидаемый результат:**
- ✔ Prisma применяет миграции
- ✔ Таблицы создаются
- ✔ Нет ошибок вида P1000 / P1001 / P2021

**Последующие миграции:**
```bash
cd backend
pnpm exec prisma migrate dev --name migration_name
```

#### Команды для ручной проверки БД

**Подключение к БД из контейнера:**

```bash
docker exec -it aos-postgres psql -U aos -d aosdb
```

**В psql можно проверить:**
```sql
-- Список таблиц
\dt

-- Список всех таблиц с схемами
\dt+ public.*

-- Выход
\q
```

**Проверка подключения из backend:**

```bash
cd backend
pnpm exec prisma db pull  # Проверка подключения
```

### Генерация Prisma Client

После изменения `schema.prisma` необходимо сгенерировать клиент:

```bash
cd backend
pnpm exec prisma generate
```

**Последующие миграции:**
```bash
# Создать новую миграцию
npx prisma migrate dev --name migration_name

# Применить миграции (в production)
npx prisma migrate deploy

# Откатить миграцию (удаляет все данные!)
npx prisma migrate reset
```

### Prisma Studio (GUI для базы данных)
```bash
npx prisma studio
```

## Схема базы данных (ERD v0)

База данных AOS состоит из следующих групп таблиц:

### 1. Организационная структура (Org Structure)

#### `countries` — Страны
- **Назначение:** Список стран работы системы
- **Поля:**
  - `id` — уникальный идентификатор (CUID)
  - `name` — название страны
  - `createdAt`, `updatedAt` — временные метки

#### `brands` — Бренды
- **Назначение:** Бренды, привязанные к странам
- **Поля:**
  - `id` — уникальный идентификатор
  - `name` — название бренда
  - `countryId` — связь со страной
- **Связи:** `Country` → `Brands` (1:N)

#### `marketplaces` — Маркетплейсы
- **Назначение:** Маркетплейсы, на которых продаются товары бренда
- **Поля:**
  - `id` — уникальный идентификатор
  - `name` — название маркетплейса
  - `brandId` — связь с брендом
- **Связи:** `Brand` → `Marketplaces` (1:N)

### 2. Пользователи и роли (Users & Roles)

#### `roles` — Роли пользователей
- **Назначение:** Определение ролей в системе
- **Поля:**
  - `id` — уникальный идентификатор
  - `name` — название роли (уникальное)

#### `users` — Пользователи
- **Назначение:** Пользователи системы
- **Поля:**
  - `id` — уникальный идентификатор
  - `email` — email (уникальный)
  - `password` — хэшированный пароль
  - `roleId` — связь с ролью
- **Связи:** `Role` → `Users` (1:N)

### 3. SCM (Supply Chain Management)

#### `products` — Товары
- **Назначение:** Товары бренда, продающиеся на маркетплейсах
- **Поля:**
  - `id` — уникальный идентификатор
  - `name` — название товара
  - `brandId` — связь с брендом (обязательная)
  - `marketplaceId` — связь с маркетплейсом (опциональная)
  - `category` — категория товара
- **Связи:** `Brand` → `Products` (1:N), `Marketplace` → `Products` (1:N)

#### `skus` — SKU (Stock Keeping Unit)
- **Назначение:** Уникальные единицы товара с ценами и себестоимостью
- **Поля:**
  - `id` — уникальный идентификатор
  - `code` — уникальный код SKU
  - `name` — название SKU
  - `price` — цена продажи
  - `cost` — себестоимость
  - `productId` — связь с товаром
- **Связи:** `Product` → `SKUs` (1:N)

#### `stocks` — Склады
- **Назначение:** Остатки товаров на складе
- **Поля:**
  - `id` — уникальный идентификатор
  - `skuId` — связь с SKU (уникальная, один склад на SKU)
  - `quantity` — количество на складе
- **Связи:** `SKU` → `Stock` (1:1)

#### `supplies` — Поставки
- **Назначение:** Информация о поставках товаров
- **Поля:**
  - `id` — уникальный идентификатор
  - `status` — статус поставки
  - `createdAt` — дата создания

#### `supply_items` — Элементы поставки
- **Назначение:** Конкретные товары в поставке
- **Поля:**
  - `id` — уникальный идентификатор
  - `supplyId` — связь с поставкой
  - `skuId` — связь с SKU
  - `quantity` — количество
- **Связи:** `Supply` → `SupplyItems` (1:N), `SKU` → `SupplyItems` (1:N)

### 4. BCM (Brand & Catalog Management)

#### `product_cards` — Карточки товаров
- **Назначение:** Расширенная информация о товарах (описания, изображения, атрибуты)
- **Поля:**
  - `id` — уникальный идентификатор
  - `productId` — связь с товаром (уникальная, одна карточка на товар)
  - `title` — заголовок
  - `description` — описание
  - `attributes` — JSON с атрибутами
  - `images` — JSON с изображениями
- **Связи:** `Product` → `ProductCard` (1:1)

### 5. Finance (Финансы)

#### `finance_reports` — Финансовые отчёты
- **Назначение:** Отчёты по продажам и финансам
- **Поля:**
  - `id` — уникальный идентификатор
  - `skuId` — связь с SKU
  - `date` — дата отчёта
  - `quantity` — проданное количество
  - `revenue` — выручка
  - `commission` — комиссия
  - `refunds` — возвраты
- **Индексы:** `date`, `skuId`, `(skuId, date)`
- **Связи:** `SKU` → `FinanceReports` (1:N)

### 6. Advertising (Реклама)

#### `ad_campaigns` — Рекламные кампании
- **Назначение:** Рекламные кампании на маркетплейсах
- **Поля:**
  - `id` — уникальный идентификатор
  - `marketplaceId` — связь с маркетплейсом
  - `name` — название кампании
  - `status` — статус кампании
  - `budget` — бюджет кампании
- **Связи:** `Marketplace` → `AdCampaigns` (1:N)

#### `ad_stats` — Статистика рекламы
- **Назначение:** Статистика по рекламным кампаниям
- **Поля:**
  - `id` — уникальный идентификатор
  - `campaignId` — связь с кампанией
  - `date` — дата статистики
  - `impressions` — показы
  - `clicks` — клики
  - `spend` — потрачено
  - `orders` — заказы
  - `revenue` — выручка
- **Индексы:** `campaignId`, `date`, `(campaignId, date)`
- **Связи:** `AdCampaign` → `AdStats` (1:N)

### 7. Support (Поддержка)

#### `reviews` — Отзывы
- **Назначение:** Отзывы клиентов о товарах
- **Поля:**
  - `id` — уникальный идентификатор
  - `skuId` — связь с SKU (опциональная)
  - `rating` — рейтинг (1-5)
  - `text` — текст отзыва
  - `date` — дата отзыва
- **Индексы:** `skuId`, `date`, `rating`
- **Связи:** `SKU` → `Reviews` (1:N, опциональная)

#### `support_tickets` — Тикеты поддержки
- **Назначение:** Тикеты службы поддержки
- **Поля:**
  - `id` — уникальный идентификатор
  - `text` — текст тикета
  - `status` — статус тикета
- **Индексы:** `status`, `createdAt`

### 8. Agents (Агенты)

#### `agent_scenarios` — Сценарии агентов
- **Назначение:** Конфигурация сценариев для AI-агентов
- **Поля:**
  - `id` — уникальный идентификатор
  - `key` — уникальный ключ сценария
  - `name` — название сценария
  - `endpoint` — эндпоинт для выполнения

#### `agent_runs` — Запуски агентов
- **Назначение:** Логи выполнения AI-агентов
- **Поля:**
  - `id` — уникальный идентификатор
  - `scenarioId` — связь со сценарием (опциональная)
  - `agentKey` — ключ агента
  - `input` — JSON с входными данными
  - `output` — JSON с выходными данными
  - `status` — статус выполнения
  - `error` — ошибка (если есть)
  - `startedAt` — время начала
  - `finishedAt` — время окончания
- **Индексы:** `agentKey`, `status`, `scenarioId`, `startedAt`
- **Связи:** `AgentScenario` → `AgentRuns` (1:N, опциональная)

### Связи между таблицами

```
Country (1) ──→ (N) Brand (1) ──→ (N) Marketplace (1) ──→ (N) Product
                                                              │
                                                              ├──→ (1) ProductCard
                                                              └──→ (N) SKU
                                                                    │
                                                                    ├──→ (1) Stock
                                                                    ├──→ (N) SupplyItem
                                                                    ├──→ (N) FinanceReport
                                                                    └──→ (N) Review

Role (1) ──→ (N) User

Marketplace (1) ──→ (N) AdCampaign (1) ──→ (N) AdStats

AgentScenario (1) ──→ (N) AgentRun
```

### Индексы

Все таблицы содержат необходимые индексы для оптимизации запросов:
- Индексы по внешним ключам
- Составные индексы для частых запросов (например, `(skuId, date)`)
- Уникальные индексы для полей, требующих уникальности

## Модули AOS

Backend содержит следующие модули:

- **auth** — Аутентификация и авторизация
- **users** — Управление пользователями
- **org** — Организации
- **scm** — Supply Chain Management
- **bcm** — Business Continuity Management
- **finance** — Финансы
- **advertising** — Реклама
- **support** — Поддержка
- **analytics** — Аналитика
- **settings** — Настройки
- **agents** — Агенты

### Health Check эндпоинты

Каждый доменный модуль имеет health check эндпоинт для проверки работоспособности:

- **SCM** — `GET /api/scm/health`
- **BCM** — `GET /api/bcm/health`
- **Finance** — `GET /api/finance/health`
- **Advertising** — `GET /api/advertising/health`
- **Support** — `GET /api/support/health`
- **Analytics** — `GET /api/analytics/health`
- **Settings** — `GET /api/settings/health`

**Пример запроса:**
```bash
curl http://localhost:3001/api/scm/health
```

**Пример ответа:**
```json
{
  "module": "SCM",
  "status": "ok"
}
```

Эндпоинты доступны без авторизации для удобства тестирования.

## Общая инфраструктура

### Filters (Фильтры исключений)
- `AllExceptionsFilter` — глобальная обработка всех исключений
- `HttpExceptionFilter` — обработка HTTP исключений

### Interceptors (Интерцепторы)
- `LoggingInterceptor` — логирование всех запросов и ответов

### Guards (Защитники)
- `RolesGuard` — проверка ролей (будет реализован в ТЗ №4)

### Decorators (Декораторы)
- `@CurrentUser()` — получение текущего пользователя из запроса

## Тестирование

```bash
# Unit тесты
pnpm run test

# E2E тесты
pnpm run test:e2e

# Покрытие кода
pnpm run test:cov
```

### E2E tests

Для запуска e2e-тестов используется отдельная тестовая база данных.

1. Настрой тестовую БД и переменную окружения в `backend/.env`:

```env
DATABASE_URL=postgresql://aos:<PASSWORD>@localhost:5433/aos?schema=public
TEST_DATABASE_URL=postgresql://aos:<PASSWORD>@localhost:5433/aosdb?schema=public
```

Убедись, что PostgreSQL запущен и база `aosdb` существует (либо создай её вручную).

Выполни команды:

```bash
cd backend
pnpm build
pnpm db:test:setup   # применяет миграции и сидер к TEST_DATABASE_URL
pnpm test:e2e        # запускает e2e-тесты
```

Скрипт `db-test-setup` берет строку подключения из `TEST_DATABASE_URL`. Если переменная не задана, он завершится с ошибкой.

## Требования

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6
- pnpm >= 8

## Авторизация и аутентификация

### Настройка

В файле `.env` обязательно должна быть переменная:
```env
JWT_SECRET=your-secret-key-here
```

### Сиды (начальные данные)

#### Автоматический запуск миграций и seed в Docker

При запуске backend контейнера через `docker compose up` автоматически выполняются:

1. **Prisma миграции** (`prisma migrate deploy`) — применяются все pending миграции
2. **Database seed** (`pnpm seed:prod`) — создаются начальные данные (роли, администратор, организационная структура)

Это происходит через `backend/entrypoint.sh`, который запускается при старте контейнера.

#### Ручной запуск seed (для локальной разработки)

Если вы запускаете backend локально (не в Docker), выполните команду для создания ролей и администратора:

```bash
# Убедитесь, что база данных настроена и миграции применены
# Затем выполните:
pnpm -F backend seed
# или из директории backend
pnpm run seed
```

#### Начальные данные

После выполнения seed будут созданы:

- **Роли:** `Admin`, `Manager`
- **Администратор:** 
  - Email: `admin@aos.local`
  - Password: `Tairai123`
- **Организационная структура:**
  - Countries: Russia (RU), Kazakhstan (KZ), Indonesia (ID), United Arab Emirates (AE), United States (US)
  - Brand: Test Brand (TEST_BRAND)
  - Marketplaces: OZON (OZON), Wildberries (WB), Shopee (SHOPEE), Amazon (AMAZON), Lazada (LAZADA)
- **Agent scenarios:**
  - `import_sales` — Import Sales From Marketplace
  - `import_reviews` — Import Reviews From Marketplace
  - `import_advertising` — Import Advertising Data

⚠️ **Важно:** 
- Обязательно смените пароль после первого входа!
- Обновите `endpoint` в таблице `agent_scenarios` на реальные URL webhook'ов n8n!

### API Endpoints для авторизации

#### POST `/api/auth/login`
Вход в систему.

**Request:**
```json
{
  "email": "admin@aos.local",
  "password": "Tairai123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "admin@aos.local",
    "role": "Admin"
  },
  "message": "Login successful"
}
```

**Cookies:**
- `access_token` — JWT токен (15 минут)
- `refresh_token` — Refresh токен (7 дней)

Оба токена устанавливаются в httpOnly cookies для безопасности.

#### POST `/api/auth/refresh`
Обновление токенов доступа.

**Request:** 
Токены берутся из cookies (refresh_token)

**Response:**
```json
{
  "message": "Token refreshed successfully"
}
```

**Cookies:** Обновляются `access_token` и `refresh_token`

#### POST `/api/auth/logout`
Выход из системы.

**Response:**
```json
{
  "message": "Logout successful"
}
```

**Cookies:** Очищаются `access_token` и `refresh_token`

### Управление пользователями

Все эндпоинты управления пользователями требуют роль `Admin`.

#### GET `/api/users`
Получить список всех пользователей (только для Admin).

**Headers:**
```
Cookie: access_token=<token>
```

**Response:**
```json
[
  {
    "id": "user-id",
    "email": "user@example.com",
    "roleId": "role-id",
    "role": {
      "id": "role-id",
      "name": "Admin"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET `/api/users/:id`
Получить информацию о пользователе по ID (только для Admin).

#### POST `/api/users`
Создать нового пользователя (только для Admin).

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "roleId": "role-id"
}
```

#### PATCH `/api/users/:id`
Обновить пользователя (только для Admin).

**Request:**
```json
{
  "email": "updated@example.com",
  "password": "NewPassword123!",
  "roleId": "role-id"
}
```
Все поля опциональны.

#### DELETE `/api/users/:id`
Удалить пользователя (только для Admin).

### Защита эндпоинтов

Для защиты эндпоинтов используются Guards:

1. **JwtAuthGuard** — проверяет наличие и валидность JWT токена из cookies
2. **RolesGuard** — проверяет роль пользователя

**Пример использования:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
@Get()
findAll() {
  // Только Admin может получить доступ
}
```

### Роли

Система поддерживает следующие роли:
- **Admin** — полный доступ ко всем эндпоинтам
- **Manager** — базовая роль (можно расширить под конкретные задачи)

### Пример использования

```bash
# 1. Вход в систему
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aos.local","password":"Tairai123"}' \
  -c cookies.txt

# 2. Получение списка пользователей (используем сохранённые cookies)
curl -X GET http://localhost:3001/api/users \
  -b cookies.txt

# 3. Создание нового пользователя
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "manager@example.com",
    "password": "SecurePass123!",
    "roleId": "manager-role-id"
  }'
```

## OrgModule — Управление организацией

Модуль для управления структурой организации: страны, бренды и маркетплейсы.

### Сущности

- **Country (Страна)** — страны работы системы
  - Поля: `id`, `name`, `code` (уникальный), `createdAt`, `updatedAt`
  
- **Brand (Бренд)** — бренды, привязанные к странам
  - Поля: `id`, `name`, `code` (уникальный), `countryId`, `createdAt`, `updatedAt`
  - Связь: Country → Brand (1:N)
  
- **Marketplace (Маркетплейс)** — маркетплейсы для продажи
  - Поля: `id`, `name`, `code` (уникальный), `brandId`, `createdAt`, `updatedAt`
  - Связь: Brand → Marketplace (1:N)

### Иерархия

```
Country (1) ──→ (N) Brand (1) ──→ (N) Marketplace
```

### API Endpoints

#### Countries (Страны)

- **GET** `/api/org/countries` — список всех стран (требует авторизацию)
- **GET** `/api/org/countries/:id` — получить страну по ID (требует авторизацию)
- **POST** `/api/org/countries` — создать страну (только Admin)
- **PATCH** `/api/org/countries/:id` — обновить страну (только Admin)
- **DELETE** `/api/org/countries/:id` — удалить страну (только Admin)

#### Brands (Бренды)

- **GET** `/api/org/brands` — список всех брендов с информацией о стране (требует авторизацию)
- **GET** `/api/org/brands/:id` — получить бренд по ID с полной информацией (требует авторизацию)
- **POST** `/api/org/brands` — создать бренд (только Admin)
- **PATCH** `/api/org/brands/:id` — обновить бренд (только Admin)
- **DELETE** `/api/org/brands/:id` — удалить бренд (только Admin)

#### Marketplaces (Маркетплейсы)

- **GET** `/api/org/marketplaces` — список всех маркетплейсов с информацией о бренде и стране (требует авторизацию)
- **GET** `/api/org/marketplaces/:id` — получить маркетплейс по ID с полной информацией (требует авторизацию)
- **POST** `/api/org/marketplaces` — создать маркетплейс (только Admin)
- **PATCH** `/api/org/marketplaces/:id` — обновить маркетплейс (только Admin)
- **DELETE** `/api/org/marketplaces/:id` — удалить маркетплейс (только Admin)

### Авторизация

- **GET эндпоинты** — доступны всем авторизованным пользователям (`JwtAuthGuard`)
- **POST/PATCH/DELETE эндпоинты** — доступны только пользователям с ролью `Admin` (`JwtAuthGuard` + `RolesGuard`)

### Примеры запросов

#### Создание страны
```bash
curl -X POST http://localhost:3001/api/org/countries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Russia",
    "code": "RU"
  }'
```

**Request:**
```json
{
  "name": "Russia",
  "code": "RU"
}
```

**Response:**
```json
{
  "id": "country-id",
  "name": "Russia",
  "code": "RU",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Создание бренда
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

**Request:**
```json
{
  "name": "Test Brand",
  "code": "TEST_BRAND",
  "countryId": "country-id"
}
```

**Response:**
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

#### Создание маркетплейса
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

**Request:**
```json
{
  "name": "OZON",
  "code": "OZON",
  "brandId": "brand-id"
}
```

**Response:**
```json
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
```

#### Получение списка маркетплейсов
```bash
curl -X GET http://localhost:3001/api/org/marketplaces \
  -b cookies.txt
```

**Response:**
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

### Начальные данные (сиды)

После выполнения `pnpm run seed` будут созданы:

- **Country:** Russia (RU)
- **Brand:** Test Brand (TEST_BRAND)
- **Marketplace:** OZON (OZON)

### Swagger документация

API документация доступна по адресу: `http://localhost:3001/api/docs`

## AgentsModule — Управление агентами n8n

Модуль для запуска агентов в n8n и получения результатов выполнения.

### Назначение

AgentsModule предоставляет интерфейс для:
- Запуска сценариев агентов в n8n
- Приёма callback'ов с результатами выполнения
- Хранения истории запусков в базе данных
- Просмотра логов и статусов выполнения

Агенты выполняются в n8n, AOS выступает в роли "менеджера запусков".

### Сущности

- **AgentScenario (Сценарий агента)** — конфигурация сценария для n8n
  - Поля: `id`, `key` (уникальный), `name`, `endpoint` (URL webhook n8n), `createdAt`, `updatedAt`
  
- **AgentRun (Запуск агента)** — история выполнения агента
  - Поля: `id`, `scenarioId`, `agentKey`, `input` (JSON), `output` (JSON), `status`, `error`, `startedAt`, `finishedAt`
  - Связь: AgentScenario → AgentRun (1:N)

### Статусы AgentRun

- **RUNNING** — агент запущен и выполняется
- **SUCCESS** — агент успешно завершён
- **ERROR** — ошибка при выполнении агента
- **PENDING** — агент в очереди (не используется на этапе 0)

### API Endpoints

#### POST `/api/agents/run`
Запуск агента (требует авторизацию).

**Request:**
```json
{
  "agent": "import_sales",
  "params": {
    "marketplace": "OZON",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31"
  }
}
```

**Response:**
```json
{
  "id": "run-id",
  "agentKey": "import_sales",
  "status": "RUNNING",
  "startedAt": "2024-01-01T00:00:00.000Z"
}
```

#### POST `/api/agents/callback/:runId`
Callback от n8n с результатом выполнения (без авторизации).

**URL:** `/api/agents/callback/{runId}`

**Request:**
```json
{
  "status": "success",
  "data": {
    "imported": 150,
    "errors": 0
  }
}
```

Или при ошибке:
```json
{
  "status": "error",
  "error": "Failed to connect to marketplace API"
}
```

**Response:**
```json
{
  "id": "run-id",
  "status": "SUCCESS",
  "finishedAt": "2024-01-01T00:05:00.000Z"
}
```

#### GET `/api/agents/runs`
Получить список запусков агентов (требует авторизацию).

**Query параметры:**
- `agentKey` (опционально) — фильтр по ключу агента
- `status` (опционально) — фильтр по статусу (RUNNING, SUCCESS, ERROR)
- `limit` (опционально) — ограничение количества результатов (макс. 100, по умолчанию 50)

**Пример запроса:**
```bash
GET /api/agents/runs?agentKey=import_sales&status=SUCCESS&limit=20
```

**Response:**
```json
[
  {
    "id": "run-id",
    "agentKey": "import_sales",
    "status": "SUCCESS",
    "input": {
      "marketplace": "OZON",
      "dateFrom": "2024-01-01"
    },
    "output": {
      "imported": 150
    },
    "error": null,
    "startedAt": "2024-01-01T00:00:00.000Z",
    "finishedAt": "2024-01-01T00:05:00.000Z",
    "scenario": {
      "id": "scenario-id",
      "key": "import_sales",
      "name": "Import Sales From Marketplace"
    }
  }
]
```

### Процесс работы

1. **Запуск агента:**
   - Клиент вызывает `POST /api/agents/run` с `agentKey` и параметрами
   - AOS создаёт запись `AgentRun` со статусом `RUNNING`
   - AOS отправляет HTTP-запрос на webhook n8n (`scenario.endpoint`)
   - n8n получает `runId`, `agentKey` и `params`, начинает выполнение

2. **Callback от n8n:**
   - После завершения n8n вызывает `POST /api/agents/callback/:runId`
   - AOS обновляет `AgentRun`: устанавливает статус `SUCCESS` или `ERROR`, сохраняет `output` и `finishedAt`

3. **Просмотр истории:**
   - Клиент может получить список всех запусков через `GET /api/agents/runs`
   - Доступна фильтрация по `agentKey` и `status`

### Начальные данные (сиды)

После выполнения `pnpm run seed` будут созданы следующие сценарии:

- **import_sales** — Import Sales From Marketplace
- **import_reviews** — Import Reviews From Marketplace
- **import_advertising** — Import Advertising Data

⚠️ **Важно:** После создания сценариев необходимо обновить `endpoint` в базе данных на реальные URL webhook'ов n8n.

### Пример использования

```bash
# 1. Запуск агента
curl -X POST http://localhost:3001/api/agents/run \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "agent": "import_sales",
    "params": {
      "marketplace": "OZON",
      "dateFrom": "2024-01-01"
    }
  }'

# 2. Просмотр истории запусков
curl -X GET "http://localhost:3001/api/agents/runs?agentKey=import_sales&status=SUCCESS" \
  -b cookies.txt
```

### Swagger документация

API документация доступна по адресу: `http://localhost:3001/api/docs`

## SCMModule — Supply Chain Management

Модуль для управления цепочкой поставок: товары, SKU, остатки и поставки.

### Сущности

- **Product (Товар)** — товары бренда
  - Поля: `id`, `name`, `brandId`, `marketplaceId` (опционально), `category`, `createdAt`, `updatedAt`
  - Связи: Brand → Product (1:N), Marketplace → Product (1:N, опционально)
  
- **Sku** — единицы товара с ценами
  - Поля: `id`, `productId`, `code` (уникальный), `name`, `price`, `cost`, `createdAt`, `updatedAt`
  - Связь: Product → Sku (1:N)
  
- **Stock (Остаток)** — остатки на складе
  - Поля: `id`, `skuId`, `quantity`, `updatedAt`
  - Связь: Sku → Stock (1:1, уникальный индекс на skuId)
  
- **Supply (Поставка)** — поставки товаров
  - Поля: `id`, `status`, `createdAt`, `updatedAt`
  - Статусы: `PENDING`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`
  
- **SupplyItem (Позиция поставки)** — элементы поставки
  - Поля: `id`, `supplyId`, `skuId`, `quantity`
  - Связь: Supply → SupplyItem (1:N), Sku → SupplyItem (1:N)

### API Endpoints

#### Products (Товары)

- **GET** `/api/scm/products` — список товаров (требует авторизацию)
  - Query параметры: `name?`, `skuCode?`, `brandId?`, `page?`, `limit?`
  - Возвращает товары с основной информацией, брендом, маркетплейсом, основным SKU и остатками
  
- **GET** `/api/scm/products/:id` — получить товар по ID (требует авторизацию)
  - Возвращает полную информацию о товаре со всеми SKU и остатками
  
- **POST** `/api/scm/products` — создать товар (требует авторизацию)
  - При создании товара можно сразу создать базовый SKU с остатком
  
- **PATCH** `/api/scm/products/:id` — обновить товар (требует авторизацию)
  
- **DELETE** `/api/scm/products/:id` — удалить товар (требует авторизацию)

#### Stocks (Остатки)

- **GET** `/api/scm/stocks` — список остатков (требует авторизацию)
  - Query параметры: `skuId?`, `productId?`
  
- **PATCH** `/api/scm/stocks/:skuId` — обновить остаток (требует авторизацию)
  - Body: `{ quantity: number }`
  - Создаёт запись, если её нет (upsert)

#### Supplies (Поставки)

- **GET** `/api/scm/supplies` — список поставок (требует авторизацию)
  - Возвращает поставки с количеством позиций и общим количеством товаров
  
- **GET** `/api/scm/supplies/:id` — получить поставку по ID (требует авторизацию)
  - Возвращает полную информацию о поставке со всеми позициями
  
- **POST** `/api/scm/supplies` — создать поставку (требует авторизацию)
  - Body: `{ items: [{ skuId: string, quantity: number }] }`
  - Создаёт поставку со статусом `PENDING`
  
- **PATCH** `/api/scm/supplies/:id/status` — обновить статус поставки (требует авторизацию)
  - Body: `{ status: "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED" }`
  - При статусе `RECEIVED` автоматически обновляет остатки на складе

### Примеры запросов

#### Создание товара
```bash
curl -X POST http://localhost:3001/api/scm/products \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Product Name",
    "brandId": "brand-id",
    "skuCode": "SKU-001",
    "price": 1000,
    "cost": 500
  }'
```

#### Получение товаров с фильтрацией
```bash
curl -X GET "http://localhost:3001/api/scm/products?name=Product&page=1&limit=20" \
  -b cookies.txt
```

#### Создание поставки
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

#### Обновление остатка
```bash
curl -X PATCH http://localhost:3001/api/scm/stocks/sku-id \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"quantity": 100}'
```

## BCMModule — Brand & Catalog Management

Модуль для управления брендами и каталогом товаров.

### Назначение

BCMModule предоставляет функциональность для:
- Редактирования данных бренда
- Управления карточками товаров (ProductCard)
- Редактирования атрибутов, описаний, изображений товаров
- Связи продуктовых данных из SCM с контентной частью

### Сущности

- **Brand (Бренд)** — информация о бренде
  - Поля: `id`, `name`, `code` (уникальный), `countryId`, `createdAt`, `updatedAt`
  - Связь: Country → Brand (1:N)
  
- **ProductCard (Карточка товара)** — контентная информация о товаре
  - Поля: `id`, `productId` (уникальный), `title`, `description`, `attributes` (JSON), `images` (JSON), `createdAt`, `updatedAt`
  - Связь: Product → ProductCard (1:1)

### API Endpoints

#### Brand (Бренд)

- **GET** `/api/bcm/brand` — получить информацию о бренде (требует авторизацию)
  - Возвращает первый бренд в системе (v0 - single brand)
  
- **PATCH** `/api/bcm/brand` — обновить информацию о бренде (требует авторизацию)
  - Поля: `name?`, `code?`, `countryId?`

#### ProductCard (Карточка товара)

- **GET** `/api/bcm/products` — список товаров с информацией о карточках (требует авторизацию)
  - Возвращает товары с полем `cardStatus` (Complete / Needs work / No card)
  
- **GET** `/api/bcm/products/:id` — получить карточку товара по ID продукта (требует авторизацию)
  - Возвращает информацию о продукте и его карточке
  - Создаёт пустую карточку, если её нет
  
- **PATCH** `/api/bcm/products/:id/card` — создать или обновить карточку товара (требует авторизацию)
  - Поля: `title?`, `description?`, `attributes?` (JSON), `images?` (массив URL)

### Примеры запросов

#### Получить информацию о бренде
```bash
curl -X GET http://localhost:3001/api/bcm/brand \
  -b cookies.txt
```

#### Обновить бренд
```bash
curl -X PATCH http://localhost:3001/api/bcm/brand \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Brand Name",
    "code": "UPDATED_CODE"
  }'
```

#### Получить список товаров с карточками
```bash
curl -X GET http://localhost:3001/api/bcm/products \
  -b cookies.txt
```

#### Обновить карточку товара
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

## FinanceModule — Финансовый модуль

Модуль для управления финансовыми отчётами, продажами и расчёта P&L.

### Назначение

FinanceModule предоставляет функциональность для:
- Ввода финансовых строк продаж вручную
- Просмотра отчётов по продажам
- Расчёта Profit & Loss (P&L)
- Базового финансового анализа

### Сущности

- **FinanceReport (Финансовый отчёт)** — строка продаж
  - Поля: `id`, `skuId`, `date`, `quantity`, `revenue`, `commission`, `refunds`, `createdAt`
  - Связь: Sku → FinanceReport (1:N)

### Структура финансовой строки

```typescript
{
  id: string;
  skuId: string;
  date: Date;
  quantity: number;      // Количество проданных единиц
  revenue: number;       // Выручка
  commission: number;    // Комиссия маркетплейса
  refunds: number;       // Возвраты
  createdAt: Date;
}
```

### API Endpoints

#### Finance Reports (Финансовые отчёты)

- **GET** `/api/finance/reports` — получить список финансовых отчётов (требует авторизацию)
  - Query параметры: `skuId?`, `date?`, `dateFrom?`, `dateTo?`, `limit?`, `offset?`
  - Возвращает список отчётов с информацией о SKU
  
- **POST** `/api/finance/reports` — создать финансовый отчёт (требует авторизацию)
  - Body: `{ skuId, date, quantity, revenue, commission?, refunds? }`

#### P&L (Profit & Loss)

- **GET** `/api/finance/pnl` — получить P&L отчёт (требует авторизацию)
  - Query параметры: `dateFrom?`, `dateTo?`
  - Возвращает агрегаты:
    - `totalRevenue` — общая выручка
    - `totalCommission` — общая комиссия
    - `totalRefunds` — общие возвраты
    - `totalCost` — общая себестоимость (рассчитывается из SKU.cost * quantity)
    - `grossMargin` — валовая маржа (revenue - commission - refunds - cost)
    - `grossMarginPercent` — валовая маржа в процентах

### Примеры запросов

#### Создать финансовый отчёт
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

#### Получить отчёты с фильтрацией
```bash
curl -X GET "http://localhost:3001/api/finance/reports?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

#### Получить P&L отчёт
```bash
curl -X GET "http://localhost:3001/api/finance/pnl?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

**Ответ P&L:**
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

## AdvertisingModule — Модуль рекламы

Модуль для управления рекламными кампаниями и их статистикой.

### Назначение

AdvertisingModule предоставляет функциональность для:
- Создания и управления рекламными кампаниями
- Ввода и редактирования дневной статистики кампаний
- Просмотра агрегированных показателей (spend, revenue, orders, ROAS)
- Анализа эффективности рекламных кампаний

### Сущности

- **AdCampaign (Рекламная кампания)** — кампания на маркетплейсе
  - Поля: `id`, `marketplaceId`, `name`, `status` (ACTIVE/PAUSED/STOPPED), `budget`, `createdAt`, `updatedAt`
  - Связь: Marketplace → AdCampaign (1:N)
  
- **AdStats (Статистика кампании)** — дневная статистика кампании
  - Поля: `id`, `campaignId`, `date`, `impressions`, `clicks`, `spend`, `orders`, `revenue`, `createdAt`
  - Связь: AdCampaign → AdStats (1:N)

### API Endpoints

#### AdCampaign (Кампании)

- **GET** `/api/advertising/campaigns` — список кампаний (требует авторизацию)
  - Query параметры: `status?`, `search?`
  - Возвращает кампании с агрегатами: `totalSpend`, `totalRevenue`, `totalOrders`
  
- **GET** `/api/advertising/campaigns/:id` — получить кампанию по ID (требует авторизацию)
  - Query параметры: `dateFrom?`, `dateTo?` (по умолчанию последние 30 дней)
  - Возвращает кампанию со статистикой и агрегатами (включая ROAS)
  
- **POST** `/api/advertising/campaigns` — создать кампанию (требует авторизацию)
  
- **PATCH** `/api/advertising/campaigns/:id` — обновить кампанию (требует авторизацию)
  
- **DELETE** `/api/advertising/campaigns/:id` — удалить кампанию (требует авторизацию)

#### AdStats (Статистика)

- **POST** `/api/advertising/stats` — создать статистику (требует авторизацию)
  - Проверяет, что статистика за этот день ещё не существует
  
- **PATCH** `/api/advertising/stats/:id` — обновить статистику (требует авторизацию)
  
- **DELETE** `/api/advertising/stats/:id` — удалить статистику (требует авторизацию)

### Примеры запросов

#### Создать кампанию
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

#### Получить список кампаний с фильтрацией
```bash
curl -X GET "http://localhost:3001/api/advertising/campaigns?status=ACTIVE&search=Summer" \
  -b cookies.txt
```

#### Создать статистику
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

#### Получить детальную информацию о кампании
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
      "date": "2025-01-15T00:00:00.000Z",
      "impressions": 10000,
      "clicks": 500,
      "spend": 5000,
      "orders": 50,
      "revenue": 50000
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

## SupportModule — Модуль поддержки

Модуль для управления отзывами и обращениями в поддержку.

### Назначение

SupportModule предоставляет функциональность для:
- Просмотра отзывов о товарах
- Фильтрации отзывов по различным критериям
- Создания и управления тикетами поддержки
- Отслеживания статусов обращений

### Сущности

- **Review (Отзыв)** — отзыв о товаре
  - Поля: `id`, `skuId` (опционально), `rating` (1-5), `text`, `date`, `createdAt`
  - Связь: Sku → Review (1:N, опционально)
  
- **SupportTicket (Тикет поддержки)** — обращение в поддержку
  - Поля: `id`, `text`, `status` (NEW/IN_PROGRESS/RESOLVED/CLOSED), `createdAt`, `updatedAt`
  - Примечание: title хранится как первая строка в text

### API Endpoints

#### Reviews (Отзывы)

- **GET** `/api/support/reviews` — получить список отзывов (требует авторизацию)
  - Query параметры: `rating?`, `minRating?`, `skuId?`, `dateFrom?`, `dateTo?`
  - Возвращает отзывы с информацией о SKU и товаре
  
- **POST** `/api/support/reviews` — создать отзыв (для тестирования) (требует авторизацию)

#### Support Tickets (Тикеты)

- **GET** `/api/support/tickets` — получить список тикетов (требует авторизацию)
  
- **GET** `/api/support/tickets/:id` — получить тикет по ID (требует авторизацию)
  - Возвращает тикет с извлечёнными title и body
  
- **POST** `/api/support/tickets` — создать тикет (требует авторизацию)
  
- **PATCH** `/api/support/tickets/:id/status` — обновить статус тикета (требует авторизацию)

### Примеры запросов

#### Получить отзывы с фильтрацией
```bash
curl -X GET "http://localhost:3001/api/support/reviews?minRating=4&dateFrom=2025-01-01" \
  -b cookies.txt
```

#### Создать отзыв
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

#### Создать тикет
```bash
curl -X POST http://localhost:3001/api/support/tickets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Product quality issue",
    "text": "Customer reported quality issues with the product."
  }'
```

#### Обновить статус тикета
```bash
curl -X PATCH http://localhost:3001/api/support/tickets/ticket-id/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

## AnalyticsModule — Модуль аналитики

Модуль для агрегации и анализа бизнес-данных.

### Назначение

AnalyticsModule предоставляет функциональность для:
- Агрегации данных по продажам, маржинальности, рекламе, остаткам и отзывам
- Формирования аналитических дашбордов
- Предоставления сводной статистики для принятия решений

### API Endpoints

#### Dashboard

- **GET** `/api/analytics/dashboard` — получить данные дашборда (требует авторизацию)
  - Query параметры: `dateFrom?` (YYYY-MM-DD), `dateTo?` (YYYY-MM-DD)
  - Если параметры не указаны, используется период последних 30 дней
  - Возвращает агрегаты по продажам, маржинальности, рекламе, остаткам и отзывам

### Структура ответа

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

### Источники данных

- **Продажи** — из таблицы `FinanceReport` (revenue, quantity, refunds)
- **Маржинальность** — себестоимость из `Sku.cost * FinanceReport.quantity`
- **Реклама** — из таблицы `AdStats` (spend, revenue)
- **Остатки** — из таблицы `Stock` (количество SKU, общее количество, низкий остаток < 10)
- **Отзывы** — из таблицы `Review` (количество, средний рейтинг, негативные отзывы)

### Пример запроса

```bash
curl -X GET "http://localhost:3001/api/analytics/dashboard?dateFrom=2025-01-01&dateTo=2025-01-31" \
  -b cookies.txt
```

## API Endpoints

Все API endpoints имеют префикс `/api`:

- `/api/auth/*` — эндпоинты аутентификации (см. раздел выше)
- `/api/users/*` — управление пользователями (требует роль Admin)
- `/api/org/*` — организация (страны, бренды, маркетплейсы) (см. раздел выше)
- `/api/scm/*` — Supply Chain Management (см. раздел выше)
- `/api/bcm/*` — Brand & Catalog Management (см. раздел выше)
- `/api/finance/*` — Финансы (см. раздел выше)
- `/api/advertising/*` — Реклама (см. раздел выше)
- `/api/support/*` — Поддержка (см. раздел выше)
- `/api/analytics/*` — Аналитика (см. раздел выше)
- `/api/settings/*` — Настройки (см. Health Check эндпоинты)
- `/api/agents/*` — Агенты (см. раздел выше)
