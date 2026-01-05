-- AlterTable
ALTER TABLE "brand_countries" ADD COLUMN     "legalEntityId" TEXT;

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "inn" TEXT,
    "kpp" TEXT,
    "ogrn" TEXT,
    "legalAddr" TEXT,
    "bankName" TEXT,
    "bik" TEXT,
    "account" TEXT,
    "corrAccount" TEXT,
    "director" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_entities_countryId_idx" ON "legal_entities"("countryId");

-- CreateIndex
CREATE INDEX "brand_countries_legalEntityId_idx" ON "brand_countries"("legalEntityId");

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_countries" ADD CONSTRAINT "brand_countries_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
