## Developer guide (thin index)

This file is intentionally short. Canonical Source of Truth:
- `docs/product/00-current-scope-and-goals.md`
- `docs/architecture/SCM_FINANCE_CANON.md`

Runbooks:
- Deploy / run: `docs/runbooks/deploy.md`
- Ops checklist: `docs/runbooks/operations-checklist.md`
- Data integrity: `docs/runbooks/data-integrity.md`
- E2E / CI guardrails: `docs/runbooks/e2e-ci.md`

If this file conflicts with canon/runbooks, treat this file as non-authoritative and follow the docs above.

### 4.2. Запуск backend локально

```bash
cd backend
pnpm start:dev
```

Backend будет доступен на http://localhost:3001

### 4.3. Запуск frontend локально

В отдельном терминале:

```bash
cd frontend
pnpm dev
```

Frontend будет доступен на http://localhost:3000

### 4.4. Переменные окружения

Для локального запуска создайте файл `.env` в корне проекта (если его еще нет):

```env
DATABASE_URL=postgresql://aos:aos@localhost:5433/aosdb?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=changeme
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 5. Типовые проблемы и решения

### 5.1. Port already in use при pnpm dev или pnpm start:dev

**Проблема**: Порты 3000 или 3001 уже заняты.

**Причина**: Скорее всего, уже запущены Docker контейнеры, которые слушают эти порты.

**Решение**:
- Остановите Docker контейнеры: `cd infra && docker compose down`
- Или не запускайте локальный `pnpm dev`, если AOS работает в Docker

### 5.2. Ошибка Docker: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified

**Проблема**: Docker не может подключиться к Docker Desktop.

**Причина**: Docker Desktop не запущен.

**Решение**:
1. Запустите Docker Desktop
2. Дождитесь статуса "Running" в трее
3. Повторите команду

### 5.3. Ошибка фронта при сборке: Cannot find module 'next/dist/bin/next'

**Проблема**: Next.js не найден при сборке в Docker.

**Решение**: Эта проблема уже решена в `Dockerfile.frontend` (builder-stage делает `pnpm install` и `pnpm build`).

Если ошибка все еще появляется:
1. Проверьте, что `next` есть в `frontend/package.json`
2. Убедитесь, что шаги `pnpm install` в Dockerfile не сломаны
3. Пересоберите образ: `cd infra && docker compose build frontend --no-cache`

### 5.4. Backend не собирается, потому что нет backend/dist

**Проблема**: Dockerfile.backend ожидает, что `backend/dist` уже собран.

**Решение**:
```bash
pnpm dev:backend:build
cd infra
docker compose build backend
```

**Важно**: `Dockerfile.backend` использует уже собранный `backend/dist` с хоста. Это сделано для ускорения сборки и уменьшения размера образа. Всегда собирайте backend перед `docker compose build backend`.

### 5.5. Ошибка подключения к базе данных

**Проблема**: Backend не может подключиться к PostgreSQL.

**Решение**:
1. Убедитесь, что PostgreSQL контейнер запущен: `docker compose ps`
2. Проверьте переменную окружения `DATABASE_URL` в docker-compose.yml
3. Проверьте, что порт 5433 не занят другим процессом

### 5.6. Frontend не может подключиться к backend API

**Проблема**: Frontend получает ошибки при запросах к API.

**Решение**:
1. Проверьте переменную окружения `NEXT_PUBLIC_API_URL` в docker-compose.yml или `.env`
2. Убедитесь, что backend запущен и доступен
3. Проверьте CORS настройки в backend (если есть)

## 6. Мини-памятка по интеграциям маркетплейсов

### Где в UI

- **Settings → Marketplace integrations** — управление интеграциями

### Где API

- **GET** `/api/settings/marketplace-integrations` — список интеграций
- **POST** `/api/settings/marketplace-integrations` — создание интеграции
- **GET** `/api/settings/marketplace-integrations/:id` — детали интеграции
- **PATCH** `/api/settings/marketplace-integrations/:id` — обновление интеграции
- **POST** `/api/settings/marketplace-integrations/:id/test-connection` — тест подключения

### Где смотреть логи интеграций

Логи интеграций хранятся в таблице `integration_logs` в базе данных PostgreSQL.

Для просмотра логов:

```bash
# Подключиться к PostgreSQL
docker compose exec postgres psql -U aos -d aosdb

# Посмотреть логи
SELECT * FROM integration_logs ORDER BY "createdAt" DESC LIMIT 100;

# Логи по конкретной интеграции
SELECT * FROM integration_logs WHERE "integrationId" = '<integration-id>' ORDER BY "createdAt" DESC;
```

Или через Prisma Studio:

```bash
cd backend
pnpm prisma studio
```

## 7. Полезные команды

### Docker

```bash
# Просмотр статуса контейнеров
cd infra
docker compose ps

# Перезапуск конкретного сервиса
docker compose restart backend

# Просмотр логов в реальном времени
docker compose logs -f backend

# Очистка всех контейнеров и volumes (осторожно!)
docker compose down -v
```

### Backend

```bash
# Сборка
pnpm --filter backend build

# Запуск в dev режиме
pnpm --filter backend start:dev

# Запуск миграций
cd backend
pnpm prisma migrate dev

# Генерация Prisma Client
pnpm prisma generate

# Prisma Studio (GUI для БД)
pnpm prisma studio
```

### Frontend

```bash
# Запуск в dev режиме
pnpm --filter frontend dev

# Сборка
pnpm --filter frontend build

# Линтинг
pnpm --filter frontend lint
```

## 8. Структура базы данных

Основные таблицы:

- `marketplace_integrations` — интеграции маркетплейсов
- `integration_logs` — логи интеграций и агентов
- `agent_runs` — запуски агентов
- `agent_scenarios` — сценарии агентов
- `marketplaces` — маркетплейсы
- `brands` — бренды
- `countries` — страны

Для просмотра схемы БД используйте Prisma Studio или подключитесь к PostgreSQL напрямую.

## 9. Разработка новых функций

### Добавление новой миграции Prisma

```bash
cd backend
pnpm prisma migrate dev --name your_migration_name
```

### Добавление нового API эндпоинта

1. Создайте контроллер в соответствующем модуле
2. Добавьте сервис с бизнес-логикой
3. Создайте DTO для валидации
4. Добавьте тесты (e2e или unit)

### Добавление новой страницы во frontend

1. Создайте файл в `frontend/app/(protected)/your-page/page.tsx`
2. Используйте существующие компоненты из `components/ui/`
3. Добавьте переводы в `frontend/lib/i18n/locales/en/`

## 10. Контакты и поддержка

При возникновении проблем:

1. Проверьте раздел "Типовые проблемы и решения" выше
2. Проверьте логи: `docker compose logs`
3. Убедитесь, что все зависимости установлены: `pnpm install`
4. Проверьте, что Docker Desktop запущен

---

**Последнее обновление**: 2025-01-27




























