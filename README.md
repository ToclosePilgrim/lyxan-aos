# Ly[x]an AOS - Agentic Operating System

Монорепозиторий для управления e-commerce платформой.

## Структура проекта

```
/aos
  /backend      - NestJS приложение
  /frontend     - Next.js приложение (App Router)
  /shared       - Общие типы и константы
  /infra        - Docker конфигурации и окружения
```

## Установка

```bash
pnpm install
```

## Запуск

### Локальная разработка

#### Backend
```bash
pnpm -F backend start
```

#### Frontend
```bash
pnpm -F frontend dev
```

### Запуск AOS v0 в Docker

Самый простой способ запустить весь стек одной командой из корня проекта.

**Требования:**
- Docker + Docker Compose
- pnpm / corepack

**Команды:**

```bash
# из корня репозитория
pnpm docker:up              # сборка и запуск всех сервисов в foreground
pnpm docker:up:detached      # запуск в фоне
pnpm docker:down             # остановить и очистить volume'ы
```

**Что происходит при запуске:**

1. **Backend автоматически:**
   - Применяет Prisma миграции (`prisma migrate deploy`)
   - Выполняет seed (`prisma db seed`), если настроен
   - Стартует NestJS приложение только после успешных миграций

2. **Все сервисы поднимаются:**
   - `aos-postgres` — PostgreSQL база данных
   - `aos-redis` — Redis для кэширования
   - `aos-backend` — Backend API (NestJS)
   - `aos-frontend` — Frontend (Next.js)
   - `aos-n8n` — n8n для автоматизации (опционально)

**После успешного запуска доступны:**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Swagger документация**: http://localhost:3001/api/docs
- **n8n**: http://localhost:5678

**Дефолтный админ:**

- **Email**: `admin@aos.local`
- **Password**: `Tairai123`

⚠️ **Важно:** Обязательно смените пароль после первого входа!

**Повторный запуск:**

При повторном запуске `pnpm docker:up`:
- Миграции и seed выполняются идемпотентно (не ломают контейнер, если данные уже есть)
- Все сервисы поднимаются штатно

### Healthcheck'и

Все ключевые сервисы имеют настроенные healthcheck'и для мониторинга их состояния:

- **Postgres**: `pg_isready -U aos -d aosdb`
- **Redis**: `redis-cli ping`
- **Backend**: `GET /api/health` (возвращает `{ status: 'ok' }`)
- **Frontend**: `GET /` (Next.js главная страница)
- **n8n**: `GET /healthz` (опционально)

**Проверка статуса:**

В `docker compose ps` статус контейнеров будет `Up (healthy)`, если всё работает корректно.

**Зависимости при запуске:**

- Backend не стартует, пока не готовы Postgres и Redis (`condition: service_healthy`)
- Frontend не стартует, пока backend не перешёл в состояние `healthy`

Это гарантирует, что сервисы не пытаются подключиться к ещё не готовым зависимостям, что исключает ошибки подключения в логах при старте.

## Ly[x]an AOS v0 — Stage 0 Runtime Passport

### Сервисы и порты

- **Frontend (Next.js)**
  - URL: http://localhost:3000
  - Назначение: веб-UI AOS (авторизация, BCM и т.д.)

- **Backend (NestJS)**
  - URL: http://localhost:3001
  - Health: http://localhost:3001/api/health
  - API base: http://localhost:3001/api
  - Swagger: http://localhost:3001/api/docs

## Архитектурные решения (ADR)

- [`docs/adr/ADR-0001-mdm-counterparty-scm-supplier-boundary.md`](docs/adr/ADR-0001-mdm-counterparty-scm-supplier-boundary.md)

- **PostgreSQL**
  - Host: localhost
  - Port: 5433 (внутри docker сети: postgres:5432)
  - Database: aosdb
  - User/Pass: aos / aos

- **Redis**
  - Host: localhost
  - Port: 6379

- **n8n**
  - URL: http://localhost:5678

### Окружения (.env)

1. **Скопировать шаблон:**

   ```bash
   cp .env.example .env
   ```

2. **При необходимости отредактировать значения:**

   - `JWT_SECRET` — секретный ключ для JWT токенов (обязательно смените в production!)
   - `DATABASE_URL` — строка подключения к PostgreSQL для локальной разработки (localhost:5433)
   - `BACKEND_DATABASE_URL` — строка подключения к PostgreSQL для Docker (postgres:5432, используется автоматически)
   - `REDIS_URL` — строка подключения к Redis (если Redis не по дефолту)
   - `NEXT_PUBLIC_API_URL` — URL backend API для frontend (если backend на другом хосте/порту)

### Команды запуска

```bash
# поднять все сервисы (build + run)
pnpm docker:up

# поднять в фоне
pnpm docker:up:detached

# остановить и очистить volumes
pnpm docker:down
```

### Дефолтный доступ

**Admin:**

- Email: `admin@aos.local`
- Password: `Tairai123`

⚠️ **Важно:** Обязательно смените пароль после первого входа!

### Диагностика

```bash
# статус контейнеров и healthcheck
cd infra
docker compose ps

# логи backend
docker compose logs backend --tail=200

# логи frontend
docker compose logs frontend --tail=200

# проверить БД
docker compose exec postgres psql -U aos -d aosdb -c '\dt'

# проверить health backend
curl http://localhost:3001/api/health
```

Подробные инструкции по работе с Docker см. в [infra/README.md](infra/README.md).

## Пакеты

- **backend** - Backend API на NestJS
- **frontend** - Frontend на Next.js с App Router
- **shared** - Общие TypeScript типы и константы
- **infra** - Docker конфигурации и CI/CD настройки

## Guardrails v1

Все новые патчи и фичи должны соответствовать правилам разработки, описанным в [docs/dev/guardrails.md](docs/dev/guardrails.md).

### Тестирование

Перед коммитом и мёрджем патча убедитесь, что все тесты проходят:

```bash
# Unit и интеграционные тесты backend
pnpm test

# E2E тесты backend
pnpm test:e2e

# Smoke тесты frontend (Playwright)
# Перед первым запуском необходимо установить браузеры:
pnpm --filter frontend playwright:install
pnpm test:smoke

# Сборка проекта
pnpm build
```

Все тесты должны быть зелёными перед мёрджем.

### Минимальные требования

- Все API возвращают 2xx на happy path
- Нет 500 ошибок в логах backend
- Фронтенд страницы открываются без ошибок
- Все миграции применены
- Shared enum'ы используются корректно
- Нет ручных строковых ENUM-значений

Подробнее см. [docs/dev/guardrails.md](docs/dev/guardrails.md).


