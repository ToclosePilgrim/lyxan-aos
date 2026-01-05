-- CreateEnum
CREATE TYPE "BcmListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "bcm_product_contents" (
    "id" TEXT NOT NULL,
    "scmProductId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "bulletPoints" JSONB,
    "attributes" JSONB,
    "media" JSONB,
    "seo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcm_product_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcm_listings" (
    "id" TEXT NOT NULL,
    "scmProductId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "offerCode" TEXT,
    "externalOfferId" TEXT,
    "status" "BcmListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bcm_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bcm_listing_versions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bcm_listing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bcm_product_contents_countryId_idx" ON "bcm_product_contents"("countryId");

-- CreateIndex
CREATE INDEX "bcm_product_contents_scmProductId_idx" ON "bcm_product_contents"("scmProductId");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_product_contents_scmProductId_countryId_lang_key" ON "bcm_product_contents"("scmProductId", "countryId", "lang");

-- CreateIndex
CREATE INDEX "bcm_listings_countryId_brandId_marketplaceId_idx" ON "bcm_listings"("countryId", "brandId", "marketplaceId");

-- CreateIndex
CREATE INDEX "bcm_listings_scmProductId_idx" ON "bcm_listings"("scmProductId");

-- CreateIndex
CREATE INDEX "bcm_listings_marketplaceId_externalOfferId_idx" ON "bcm_listings"("marketplaceId", "externalOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_listings_scmProductId_countryId_brandId_marketplaceId_key" ON "bcm_listings"("scmProductId", "countryId", "brandId", "marketplaceId");

-- CreateIndex
CREATE INDEX "bcm_listing_versions_listingId_idx" ON "bcm_listing_versions"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "bcm_listing_versions_listingId_version_key" ON "bcm_listing_versions"("listingId", "version");

-- AddForeignKey
ALTER TABLE "bcm_product_contents" ADD CONSTRAINT "bcm_product_contents_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_product_contents" ADD CONSTRAINT "bcm_product_contents_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listings" ADD CONSTRAINT "bcm_listings_scmProductId_fkey" FOREIGN KEY ("scmProductId") REFERENCES "scm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listings" ADD CONSTRAINT "bcm_listings_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listings" ADD CONSTRAINT "bcm_listings_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listings" ADD CONSTRAINT "bcm_listings_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bcm_listing_versions" ADD CONSTRAINT "bcm_listing_versions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "bcm_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
