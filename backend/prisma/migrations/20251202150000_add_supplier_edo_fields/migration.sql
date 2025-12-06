-- AlterTable
ALTER TABLE "suppliers" 
  ADD COLUMN IF NOT EXISTS "edoSystem" TEXT,
  ADD COLUMN IF NOT EXISTS "edoNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "ceoFullName" TEXT;

