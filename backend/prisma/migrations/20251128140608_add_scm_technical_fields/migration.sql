-- AlterTable
ALTER TABLE "products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "countryOfOriginCode" TEXT,
ADD COLUMN     "grossWeightGrams" INTEGER,
ADD COLUMN     "heightMm" INTEGER,
ADD COLUMN     "lengthMm" INTEGER,
ADD COLUMN     "netWeightGrams" INTEGER,
ADD COLUMN     "technicalAttributes" JSONB,
ADD COLUMN     "widthMm" INTEGER;

-- AlterTable
ALTER TABLE "scm_products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "countryOfOriginCode" TEXT,
ADD COLUMN     "grossWeightGrams" INTEGER,
ADD COLUMN     "heightMm" INTEGER,
ADD COLUMN     "lengthMm" INTEGER,
ADD COLUMN     "netWeightGrams" INTEGER,
ADD COLUMN     "technicalAttributes" JSONB,
ADD COLUMN     "widthMm" INTEGER;
