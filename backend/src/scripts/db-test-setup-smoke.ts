import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env: prefer .env.test, fallback .env
const envTestPath = path.join(__dirname, '../../.env.test');
const envPath = path.join(__dirname, '../../.env');

try {
  if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath });
  } else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch {
  // ignore
}

function guessTestDatabaseUrl(): string {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    return 'postgresql://aos:aos@localhost:5433/aosdb_e2e_smoke?schema=public';
  }
  try {
    const u = new URL(base);
    const dbName = (u.pathname || '').replace('/', '');
    const nextDb = dbName ? `${dbName}_e2e_smoke` : 'aosdb_e2e_smoke';
    u.pathname = `/${nextDb}`;
    return u.toString();
  } catch {
    // fallback for non-URL formats
    return base;
  }
}

if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = guessTestDatabaseUrl();
  console.warn(
    `WARN: TEST_DATABASE_URL is not set. Using default: ${process.env.TEST_DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`,
  );
}

// Prisma uses DATABASE_URL
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

console.log('🔧 Setting up SMOKE test database (reset + migrate + seed)...');
console.log(
  `📊 Database URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`,
);

try {
  // NOTE: We intentionally do NOT use `prisma migrate reset` here.
  // It is destructive and can be blocked by Prisma safety guards in AI environments.
  // Clean state for smoke suite is enforced inside tests via TRUNCATE CASCADE.
  console.log('\n📦 Applying Prisma migrations...');
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
    env: process.env,
  });

  console.log('\n🌱 Running seed script...');
  execSync('node dist/seeds/seed.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
    env: process.env,
  });

  console.log('\n✅ Smoke DB setup completed successfully!');
} catch (error) {
  console.error('\n❌ Smoke DB setup failed!');
  console.error(error);
  process.exit(1);
}
