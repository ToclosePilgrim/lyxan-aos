## TZ 6 — Async Agent Trigger (BullMQ)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

### Что изменилось

- **Backend больше не вызывает n8n синхронно** в потоке HTTP-запроса.
- `POST /api/agents/run` теперь **быстро отвечает** `202 Accepted` и ставит задачу в очередь.
- Реальный вызов n8n происходит воркером BullMQ в очереди **`agent-dispatch`**.
- При ошибках включены **retries/backoff** и **DLQ** (**`agent-dispatch-dlq`**).

### Безопасность (важно)
- Callback `POST /api/agents/callback/:runId` защищён **HMAC + replay protection** (Redis required in prod).
- Mutating endpoints invoked by agents must use `Idempotency-Key` where required.

### Очереди

- **Queue**: `agent-dispatch`
- **DLQ**: `agent-dispatch-dlq`

Job payload включает:
- `runId`
- `endpoint` (URL n8n webhook)
- `payload` (JSON тело)
- `headers` (в т.ч. `idempotency-key`, `x-aos-dispatch-secret`)
- `idempotencyKey` (используется для job-level дедупа)

### Идемпотентность

- `jobId` = `agent-dispatch(:workflowKey):<runId>`
- Повторный enqueue с тем же `runId` **не создаёт** второй job (dedup по `jobId`).

### Конфиги (env)

- `REDIS_URL` (обязательно для очереди)
- `AGENT_DISPATCH_QUEUE_CONCURRENCY` (default 5)
- `AGENT_DISPATCH_ATTEMPTS` (default 5)
- `AGENT_DISPATCH_BACKOFF_BASE_MS` (default 5000, exponential)
- `N8N_HTTP_TIMEOUT_MS` (default 15000)
- `N8N_DISPATCH_SECRET` (опционально; уходит в header `x-aos-dispatch-secret`)
- `AGENT_DISPATCH_WORKER_ENABLED` (default true, но в `NODE_ENV=test` default false)


