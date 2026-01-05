## Local staging deployment (docker compose)

### Требования
- `docker` + `docker compose`
- `pnpm` (опционально, если хотите гонять smoke с хоста)

### 1) Подготовить env

Из корня репозитория:

```bash
cp infra/ENV.staging.example infra/ENV.staging
```

Отредактируйте `infra/ENV.staging`:
- **`JWT_SECRET`**: обязательно заменить
- при необходимости поменять порты/URL

### 2) Поднять local-staging стек

```bash
docker compose -f infra/docker-compose.staging.yml --env-file infra/ENV.staging up --build
```

Сервисы:
- Backend: `http://localhost:${BACKEND_PORT:-3001}`
- Backend API (с префиксом): `http://localhost:${BACKEND_PORT:-3001}/api`
- Frontend: `http://localhost:${FRONTEND_PORT:-3000}`

### 3) Health checks

- **Liveness**: `GET /health`
- **DB readiness**: `GET /health/db`

### 4) Миграции

В staging compose есть one-shot сервис `migrate`, который выполняет:
- `pnpm exec prisma migrate deploy`

Backend стартует только после успешного `migrate`.

### 5) Прогон e2e smoke (с хоста)

Если postgres из staging поднят на `5434`, то:

```bash
export TEST_DATABASE_URL="postgresql://aos:aos@localhost:5434/aosdb_staging?schema=public"
pnpm --filter backend test:e2e:smoke
```

### Примечание про env templates

Файлы вида `.env*` в этом репозитории могут быть заблокированы правилами workspace,
поэтому шаблоны лежат как `backend/ENV.example.template` и `infra/ENV.staging.example`.















