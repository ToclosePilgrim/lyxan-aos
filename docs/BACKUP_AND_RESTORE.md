## Backup & Restore (PostgreSQL) — local / staging-ready

### Требования
- установлен **PostgreSQL client tools**: `pg_dump`, `pg_restore` (желательно ещё `psql`)
- выставлен `DATABASE_URL`

Если `pg_dump/pg_restore` не в PATH:
- можно выставить `PG_BIN` на папку `bin` Postgres
  - пример Windows: `PG_BIN=C:\Program Files\PostgreSQL\15\bin`

### Где лежат бэкапы

Бэкап сохраняется в `backend/backups/`:
- `aos-backup-YYYYMMDD-HHMM.dump` (format=custom)

Папка `backend/backups/` добавлена в `.gitignore`.

### 1) Сделать backup

```bash
pnpm --filter backend db:backup
```

Что делает:
- читает `DATABASE_URL`
- запускает:
  - `pg_dump --format=custom --no-owner --no-acl`
- логирует время и размер файла

### 2) Восстановить из dump

```bash
pnpm --filter backend db:restore -- backend/backups/aos-backup-20251213-1200.dump
```

Что делает:
- требует подтверждение, если БД не пустая (если доступен `psql`, проверяется количество таблиц в `public`)
- запускает:
  - `pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error`

#### Non-interactive restore

```bash
pnpm --filter backend db:restore -- --yes backend/backups/aos-backup-20251213-1200.dump
```

### Safety guards
- Если `NODE_ENV=production` — restore запрещён без флага **`--force`**
- Если `DATABASE_URL` указывает не на `localhost/127.0.0.1` — выводится warning

### Пример для local-staging (docker compose)

Если Postgres в staging поднят на `localhost:5434`, можно так:

```bash
export DATABASE_URL="postgresql://aos:aos@localhost:5434/aosdb_staging?schema=public"
pnpm --filter backend db:backup
pnpm --filter backend db:restore -- --yes backend/backups/aos-backup-YYYYMMDD-HHMM.dump
```

### Типичные ошибки
- **`pg_dump not found` / `pg_restore not found`**: установите PostgreSQL client tools и добавьте их в PATH.
- **Windows PATH**: проще всего поставить `PG_BIN` на `...\PostgreSQL\<version>\bin`.
- **permission denied**: убедитесь, что user в `DATABASE_URL` имеет права на DB.
- **connection refused**: проверьте, что Postgres запущен и порт/host в `DATABASE_URL` корректны.


