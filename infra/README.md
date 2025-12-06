# Infrastructure

Директория для Docker конфигураций, docker-compose файлов и настроек окружений.

## Файлы

- `Dockerfile.backend` - Multi-stage Docker образ для backend приложения (NestJS)
- `Dockerfile.frontend` - Multi-stage Docker образ для frontend приложения (Next.js)
- `docker-compose.yml` - Конфигурация для запуска всех сервисов

## Подготовка

1. Скопируйте `.env.example` в корне проекта в `.env`:
   ```bash
   cp .env.example .env
   ```

2. При необходимости отредактируйте `.env` файл, изменив значения переменных окружения.

## Сборка и запуск стека

**Важно:** Перед сборкой Docker-образов нужно один раз локально собрать backend и frontend:

```bash
# Из корня проекта
pnpm -F backend build
pnpm -F frontend build

# Затем запускаем Docker
cd infra
docker compose up --build
```

Или из корня проекта:

```bash
pnpm -F backend build
pnpm -F frontend build
docker compose -f infra/docker-compose.yml up --build
```

**Примечание:** Backend и Frontend используют уже собранные артефакты из исходников (не собираются внутри контейнера). Backend использует `backend/dist`, Frontend использует `frontend/.next`.

## Сервисы

После запуска доступны следующие сервисы:

- **Backend**: http://localhost:3001/api
  - Swagger документация: http://localhost:3001/api/docs
- **Frontend**: http://localhost:3000
- **n8n**: http://localhost:5678 (опционально)

### База данных PostgreSQL

- **host**: localhost
- **port**: 5432
- **database**: aos
- **user**: postgres
- **password**: postgres

### Redis

- **host**: localhost
- **port**: 6379

## Полезные команды

### Остановка сервисов

```bash
docker compose down
```

### Остановка с удалением volumes (удалит данные БД)

```bash
docker compose down -v
```

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f redis
```

### Пересборка конкретного сервиса

```bash
docker compose build backend
docker compose build frontend
```

### Запуск в фоновом режиме

```bash
docker compose up -d
```

## Структура Docker образов

### Backend

Multi-stage сборка:
1. **base** - базовая стадия с Node.js и pnpm
2. **deps** - установка зависимостей через pnpm workspace
3. **production** - минимальный образ с собранным приложением

**Примечание:** Backend не собирается внутри Docker-контейнера. Используется уже собранный `dist` из исходников (требуется предварительная локальная сборка через `pnpm -F backend build`).

### Frontend

Multi-stage сборка:
1. **base** - базовая стадия с Node.js и pnpm
2. **deps** - установка зависимостей через pnpm workspace
3. **production** - минимальный образ с собранным приложением

**Примечание:** Frontend не собирается внутри Docker-контейнера. Используется уже собранный `.next` из исходников (требуется предварительная локальная сборка через `pnpm -F frontend build`).

## Переменные окружения

Все переменные окружения настраиваются через `.env` файл в корне проекта. См. `.env.example` для списка доступных переменных.
