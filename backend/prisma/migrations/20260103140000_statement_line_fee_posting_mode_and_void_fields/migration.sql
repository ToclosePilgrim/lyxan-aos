-- TZ 8.4.3.3: StatementLine fee posting mode + fee void metadata

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StatementLinePostedMode" AS ENUM ('FEE_LINK_ONLY', 'FEE_ENTRY_CREATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "statement_lines"
ADD COLUMN IF NOT EXISTS "postedMode" "StatementLinePostedMode",
ADD COLUMN IF NOT EXISTS "feeVoidedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "feeVoidReason" TEXT;

CREATE INDEX IF NOT EXISTS "statement_lines_postedMode_idx" ON "statement_lines"("postedMode");






