-- TZ 8.1 fix: ensure PostingRunStatus is a postgres enum (Prisma expects it)

DO $$
BEGIN
  CREATE TYPE "PostingRunStatus" AS ENUM ('POSTED', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Convert status column to enum (it was TEXT in initial migration)
ALTER TABLE "accounting_posting_runs"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "accounting_posting_runs"
  ALTER COLUMN "status" TYPE "PostingRunStatus"
  USING ("status"::"PostingRunStatus");

ALTER TABLE "accounting_posting_runs"
  ALTER COLUMN "status" SET DEFAULT 'POSTED'::"PostingRunStatus";


