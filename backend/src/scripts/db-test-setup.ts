import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Загружаем переменные окружения
// Сначала пробуем .env.test, если нет - используем .env
const envTestPath = path.join(__dirname, '../../.env.test');
const envPath = path.join(__dirname, '../../.env');

try {
  if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath });
  } else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (error) {
  // Если файлы не найдены, используем переменные окружения из системы
  console.warn('Warning: .env files not found, using system environment variables');
}

// Проверяем, что TEST_DATABASE_URL установлен
if (!process.env.TEST_DATABASE_URL) {
  console.error('ERROR: TEST_DATABASE_URL is not set');
  console.error('Please set TEST_DATABASE_URL environment variable to point to your test database');
  process.exit(1);
}

// Устанавливаем DATABASE_URL из TEST_DATABASE_URL для Prisma
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

console.log('🔧 Setting up test database...');
console.log(`📊 Database URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

try {
  // Применяем миграции
  console.log('\n📦 Applying Prisma migrations...');
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
    env: process.env,
  });

  // Запускаем seed
  console.log('\n🌱 Running seed script...');
  execSync('node dist/seeds/seed.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
    env: process.env,
  });

  console.log('\n✅ Database setup completed successfully!');
} catch (error) {
  console.error('\n❌ Database setup failed!');
  console.error(error);
  process.exit(1);
}

