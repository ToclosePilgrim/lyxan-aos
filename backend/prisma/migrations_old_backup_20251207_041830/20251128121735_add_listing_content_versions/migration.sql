-- CreateEnum
CREATE TYPE "ListingVersionSource" AS ENUM ('MANUAL', 'AI_AGENT', 'IMPORT');

-- CreateTable
CREATE TABLE "listing_content_versions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "source" "ListingVersionSource" NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "createdByUserId" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "keywords" TEXT,
    "contentMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_content_versions_listingId_versionNumber_idx" ON "listing_content_versions"("listingId", "versionNumber");

-- CreateIndex
CREATE INDEX "listing_content_versions_listingId_idx" ON "listing_content_versions"("listingId");

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
