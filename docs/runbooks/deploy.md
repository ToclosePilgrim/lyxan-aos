# Runbook — Deploy / Run (local + CI parity)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

---

## Prerequisites

- Node.js + pnpm (monorepo)
- Docker + Docker Compose

---

## Local (recommended: docker compose staging)

1) Prepare env:

- Copy `infra/ENV.staging.example` → `infra/ENV.staging`
- Set at least `JWT_SECRET`

2) Run:

- `docker compose -f infra/docker-compose.staging.yml --env-file infra/ENV.staging up --build`

3) Verify:

- Backend health: `GET /health`, `GET /health/db`
- Swagger: `/api/docs`

Notes:
- migrations are applied via `prisma migrate deploy`
- Prisma client generation must happen before build/runtime as configured by infra/entrypoint/CI

---

## Local (fast path: `pnpm docker:up`)

This uses `infra/docker-compose.yml` (the `pnpm docker:up` script does `cd infra && docker compose up --build`).

1) Prepare backend env (required):

- Copy `backend/.env.example` → `backend/.env`
- Keep `AGENT_CALLBACK_HMAC_SECRET` set (required because compose sets `NODE_ENV=production`)

2) Run:

- `pnpm docker:up`

3) Verify:

- Backend health: `GET /api/health`, `GET /api/health/db`
- Swagger: `/api/docs`



