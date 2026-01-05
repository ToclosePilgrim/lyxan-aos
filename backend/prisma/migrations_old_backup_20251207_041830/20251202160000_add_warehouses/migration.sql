-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('OWN', 'MANUFACTURER', 'THIRD_PARTY');

-- CreateTable
CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'OWN',
    "countryId" TEXT,
    "city" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "warehouses_countryId_idx" ON "warehouses"("countryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "warehouses_isActive_idx" ON "warehouses"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "warehouses_type_idx" ON "warehouses"("type");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;




