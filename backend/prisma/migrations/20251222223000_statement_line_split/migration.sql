-- TZ 4.3B — StatementLine split (parent/children)

-- 1) Enum add: StatementLineStatus.SPLIT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'StatementLineStatus' AND e.enumlabel = 'SPLIT'
  ) THEN
    ALTER TYPE "StatementLineStatus" ADD VALUE 'SPLIT';
  END IF;
END $$;

-- 2) Columns
ALTER TABLE "statement_lines"
  ADD COLUMN IF NOT EXISTS "parentLineId" TEXT,
  ADD COLUMN IF NOT EXISTS "isSplitParent" BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) FK + indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'statement_lines_parentLineId_fkey'
  ) THEN
    ALTER TABLE "statement_lines"
      ADD CONSTRAINT "statement_lines_parentLineId_fkey"
      FOREIGN KEY ("parentLineId") REFERENCES "statement_lines"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "statement_lines_parentLineId_idx"
  ON "statement_lines"("parentLineId");



-- 1) Enum add: StatementLineStatus.SPLIT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'StatementLineStatus' AND e.enumlabel = 'SPLIT'
  ) THEN
    ALTER TYPE "StatementLineStatus" ADD VALUE 'SPLIT';
  END IF;
END $$;

-- 2) Columns
ALTER TABLE "statement_lines"
  ADD COLUMN IF NOT EXISTS "parentLineId" TEXT,
  ADD COLUMN IF NOT EXISTS "isSplitParent" BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) FK + indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'statement_lines_parentLineId_fkey'
  ) THEN
    ALTER TABLE "statement_lines"
      ADD CONSTRAINT "statement_lines_parentLineId_fkey"
      FOREIGN KEY ("parentLineId") REFERENCES "statement_lines"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "statement_lines_parentLineId_idx"
  ON "statement_lines"("parentLineId");









