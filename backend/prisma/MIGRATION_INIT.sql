-- Initial Migration for AOS Database
-- Generated from Prisma schema.prisma
-- This file shows the SQL structure that will be created

-- Execute migration with:
-- npx prisma migrate dev --name init

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "price" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_items" (
    "id" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cards" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "attributes" JSONB,
    "images" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_reports" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "refunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_stats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "spend" DOUBLE PRECISION,
    "orders" INTEGER,
    "revenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "skuId" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scenarios" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT,
    "agentKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brands_countryId_idx" ON "brands"("countryId");
CREATE INDEX "marketplaces_brandId_idx" ON "marketplaces"("brandId");
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_roleId_idx" ON "users"("roleId");
CREATE INDEX "products_brandId_idx" ON "products"("brandId");
CREATE INDEX "products_marketplaceId_idx" ON "products"("marketplaceId");
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");
CREATE INDEX "skus_productId_idx" ON "skus"("productId");
CREATE INDEX "skus_code_idx" ON "skus"("code");
CREATE UNIQUE INDEX "stocks_skuId_key" ON "stocks"("skuId");
CREATE INDEX "stocks_skuId_idx" ON "stocks"("skuId");
CREATE INDEX "supplies_status_idx" ON "supplies"("status");
CREATE INDEX "supply_items_supplyId_idx" ON "supply_items"("supplyId");
CREATE INDEX "supply_items_skuId_idx" ON "supply_items"("skuId");
CREATE UNIQUE INDEX "product_cards_productId_key" ON "product_cards"("productId");
CREATE INDEX "product_cards_productId_idx" ON "product_cards"("productId");
CREATE INDEX "finance_reports_date_idx" ON "finance_reports"("date");
CREATE INDEX "finance_reports_skuId_idx" ON "finance_reports"("skuId");
CREATE INDEX "finance_reports_skuId_date_idx" ON "finance_reports"("skuId", "date");
CREATE INDEX "ad_campaigns_marketplaceId_idx" ON "ad_campaigns"("marketplaceId");
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");
CREATE INDEX "ad_stats_campaignId_idx" ON "ad_stats"("campaignId");
CREATE INDEX "ad_stats_date_idx" ON "ad_stats"("date");
CREATE INDEX "ad_stats_campaignId_date_idx" ON "ad_stats"("campaignId", "date");
CREATE INDEX "reviews_skuId_idx" ON "reviews"("skuId");
CREATE INDEX "reviews_date_idx" ON "reviews"("date");
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");
CREATE UNIQUE INDEX "agent_scenarios_key_key" ON "agent_scenarios"("key");
CREATE INDEX "agent_scenarios_key_idx" ON "agent_scenarios"("key");
CREATE INDEX "agent_runs_agentKey_idx" ON "agent_runs"("agentKey");
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");
CREATE INDEX "agent_runs_scenarioId_idx" ON "agent_runs"("scenarioId");
CREATE INDEX "agent_runs_startedAt_idx" ON "agent_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplaces" ADD CONSTRAINT "marketplaces_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "skus" ADD CONSTRAINT "skus_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_cards" ADD CONSTRAINT "product_cards_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_reports" ADD CONSTRAINT "finance_reports_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_stats" ADD CONSTRAINT "ad_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "agent_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;







