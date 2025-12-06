-- Add new column types as array
ALTER TABLE "suppliers" ADD COLUMN "types" "SupplierType"[] NOT NULL DEFAULT ARRAY[]::"SupplierType"[];

-- Copy existing type values to types array
UPDATE "suppliers" SET "types" = ARRAY["type"] WHERE "type" IS NOT NULL;

-- Drop old type column
ALTER TABLE "suppliers" DROP COLUMN "type";




