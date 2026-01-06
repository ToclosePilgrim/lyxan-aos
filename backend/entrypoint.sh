#!/bin/sh
set -e

cd /app/backend

echo "🔄 Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "🔧 Generating Prisma Client..."
pnpm exec prisma generate

# Seed не должен падать, если уже всё есть
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ] || [ -f "dist/seeds/seed.js" ]; then
  echo "🌱 Running Prisma seed (if configured)..."
  pnpm exec prisma db seed || echo "⚠️  Seed failed or not configured, continuing..."
fi

echo "🚀 Starting NestJS application..."
# NestJS in monorepo builds to dist/backend/src/main.js
if [ -f "dist/backend/src/main.js" ]; then
  exec node dist/backend/src/main.js
elif [ -f "dist/main.js" ]; then
  exec node dist/main.js
else
  echo "❌ Error: main.js not found in dist/backend/src/main.js or dist/main.js"
  exit 1
fi

