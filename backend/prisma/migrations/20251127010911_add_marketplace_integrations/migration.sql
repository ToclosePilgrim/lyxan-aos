-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "marketplace_integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "ozonSellerClientId" TEXT,
    "ozonSellerToken" TEXT,
    "ozonPerfClientId" TEXT,
    "ozonPerfClientSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_integrations_marketplaceId_idx" ON "marketplace_integrations"("marketplaceId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_brandId_idx" ON "marketplace_integrations"("brandId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_countryId_idx" ON "marketplace_integrations"("countryId");

-- CreateIndex
CREATE INDEX "marketplace_integrations_status_idx" ON "marketplace_integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_integrations_marketplaceId_brandId_countryId_key" ON "marketplace_integrations"("marketplaceId", "brandId", "countryId");

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_integrations" ADD CONSTRAINT "marketplace_integrations_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
