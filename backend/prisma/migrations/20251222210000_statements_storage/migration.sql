-- TZ 4.1 (follow-up) — Align StatementLine externalLineId dedup with schema
-- Migration 20251222205000_statements created a partial unique index for (accountId, externalLineId)
-- plus a non-unique index. Here we align to Prisma @@unique([accountId, externalLineId]) by:
-- - dropping the old non-unique index
-- - dropping the partial unique index
-- - ensuring a normal unique index exists (Postgres UNIQUE allows multiple NULLs)

DROP INDEX IF EXISTS "statement_lines_accountId_externalLineId_idx";
DROP INDEX IF EXISTS "statement_lines_accountId_externalLineId_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "statement_lines_accountId_externalLineId_key"
  ON "statement_lines"("accountId","externalLineId");


-- plus a non-unique index. Here we align to Prisma @@unique([accountId, externalLineId]) by:
-- - dropping the old non-unique index
-- - dropping the partial unique index
-- - ensuring a normal unique index exists (Postgres UNIQUE allows multiple NULLs)

DROP INDEX IF EXISTS "statement_lines_accountId_externalLineId_idx";
DROP INDEX IF EXISTS "statement_lines_accountId_externalLineId_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "statement_lines_accountId_externalLineId_key"
  ON "statement_lines"("accountId","externalLineId");

