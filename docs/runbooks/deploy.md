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


