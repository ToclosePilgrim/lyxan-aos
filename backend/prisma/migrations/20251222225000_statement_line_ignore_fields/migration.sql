-- TZ 4.4 — StatementLine ignore fields

ALTER TABLE "statement_lines"
  ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ignoredReason" TEXT;



ALTER TABLE "statement_lines"
  ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ignoredReason" TEXT;






