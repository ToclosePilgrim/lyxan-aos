import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Client } from 'pg';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { TestSeedModule } from '../src/modules/devtools/test-seed/test-seed.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from '../src/common/idempotency/idempotency.interceptor';
import { ScopeInterceptor } from '../src/common/scope/scope.interceptor';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __AOS_E2E_SETUP_DONE__?: boolean;
    }
  }
}

beforeAll(async () => {
  if (process.__AOS_E2E_SETUP_DONE__) return;
  process.__AOS_E2E_SETUP_DONE__ = true;

  // Provide sane defaults for local runs
  process.env.AOS_E2E = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
  const e2eDatabaseUrl =
    process.env.E2E_DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://aos:aos@localhost:5433/aosdb_e2e_smoke?schema=public';
  process.env.DATABASE_URL = e2eDatabaseUrl;

  function assertSafeE2eDatabaseName(dbName: string) {
    // Guardrail: never auto-create/drop a non-e2e database by accident
    if (!/e2e/i.test(dbName)) {
      throw new Error(
        `[e2e] Refusing to auto-create/reset non-e2e database "${dbName}". ` +
          `Set E2E_DATABASE_URL/TEST_DATABASE_URL to an e2e db name (e.g. *_e2e_*).`,
      );
    }
  }

  async function resetDatabase(databaseUrl: string) {
    const url = new URL(databaseUrl);
    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!dbName) {
      throw new Error(`Invalid DATABASE_URL (missing db name): ${databaseUrl}`);
    }
    assertSafeE2eDatabaseName(dbName);

    const maintenanceUrl = new URL(databaseUrl);
    maintenanceUrl.pathname = '/postgres';

    console.log(`[e2e] Resetting database "${dbName}"...`);
    const client = new Client({ connectionString: maintenanceUrl.toString() });
    await client.connect();
    try {
      const escaped = dbName.replace(/"/g, '""');
      // Postgres 15 supports WITH (FORCE) which terminates existing connections.
      await client.query(`DROP DATABASE IF EXISTS "${escaped}" WITH (FORCE)`);
      await client.query(`CREATE DATABASE "${escaped}"`);
    } finally {
      await client.end();
    }
  }

  async function ensureDatabaseExists(databaseUrl: string) {
    const url = new URL(databaseUrl);
    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!dbName) {
      throw new Error(`Invalid DATABASE_URL (missing db name): ${databaseUrl}`);
    }
    assertSafeE2eDatabaseName(dbName);

    const maintenanceUrl = new URL(databaseUrl);
    maintenanceUrl.pathname = '/postgres';

    const client = new Client({ connectionString: maintenanceUrl.toString() });
    await client.connect();
    try {
      const existsRes = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName],
      );
      if (existsRes.rowCount && existsRes.rowCount > 0) {
        return;
      }

      const escaped = dbName.replace(/"/g, '""');
      console.log(
        `[e2e] Database "${dbName}" does not exist. Creating it...`,
      );
      await client.query(`CREATE DATABASE "${escaped}"`);
      console.log(`[e2e] Database "${dbName}" created.`);
    } finally {
      await client.end();
    }
  }

  const preserveDb =
    String(process.env.E2E_DB_PRESERVE ?? '').toLowerCase() === 'true';
  if (preserveDb) {
    await ensureDatabaseExists(e2eDatabaseUrl);
  } else {
    await resetDatabase(e2eDatabaseUrl);
  }

  // Apply migrations (to e2e DB)
  const backendRoot = path.resolve(__dirname, '..');
  const runMigrateDeploy = () => {
    const res = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: e2eDatabaseUrl },
      encoding: 'utf8',
      shell: true,
    });
    if (res.error) {
      process.stderr.write(
        `[e2e] Failed to execute pnpm (migrate deploy): ${String(res.error)}\n`,
      );
    }
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    return res;
  };

  const first = runMigrateDeploy();
  if (first.status !== 0) {
    const combined = `${first.stdout ?? ''}\n${first.stderr ?? ''}`;
    if (/P3009/.test(combined)) {
      // This can happen if a previous e2e run got interrupted mid-migration.
      // For e2e DBs it's safe and preferable to reset to a clean slate.
      await resetDatabase(e2eDatabaseUrl);

      const second = runMigrateDeploy();
      if (second.status !== 0) {
        throw new Error('Command failed: pnpm exec prisma migrate deploy');
      }
    } else {
      throw new Error('Command failed: pnpm exec prisma migrate deploy');
    }
  }

  // Seed baseline reference data used by many e2e tests (brands, countries, marketplaces, admin user, etc).
  const seed = spawnSync('pnpm', ['exec', 'ts-node', '-T', 'src/seeds/seed.ts'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl },
    encoding: 'utf8',
    shell: true,
  });
  if (seed.error) {
    process.stderr.write(
      `[e2e] Failed to execute pnpm (seed): ${String(seed.error)}\n`,
    );
  }
  if (seed.stdout) process.stdout.write(seed.stdout);
  if (seed.stderr) process.stderr.write(seed.stderr);
  if (seed.status !== 0) {
    throw new Error('Command failed: pnpm exec ts-node -T src/seeds/seed.ts');
  }

  // IMPORTANT: PrismaClient must be generated before running e2e (handled by pnpm scripts).

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    // Extra role required by some finance tests
    await prisma.role.upsert({
      where: { name: 'FinanceManager' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'FinanceManager',
        updatedAt: new Date(),
      },
    });

    // Currency rates (minimal): ensure RUB exists so FIFO/costing can work in tests
    const today = new Date();
    const rateDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    await prisma.currencyRate.upsert({
      where: { currency_rateDate: { currency: 'RUB', rateDate } } as any,
      update: { rateToBase: '1', updatedAt: new Date() } as any,
      create: {
        id: crypto.randomUUID(),
        currency: 'RUB',
        rateDate,
        rateToBase: '1',
        updatedAt: new Date(),
        source: 'e2e',
      } as any,
    });
  } finally {
    await prisma.$disconnect();
  }
}, 120_000);

export async function createTestApp(): Promise<{
  app: INestApplication;
  request: () => supertest.SuperTest<supertest.Test>;
  loginAsAdmin: () => Promise<string>;
  createTokenWithLegalEntity: (
    userId: string,
    email: string,
    role: string,
    legalEntityId: string | null,
  ) => Promise<string>;
}> {
  const enableTestSeedApi =
    String(process.env.ENABLE_TEST_SEED_API ?? '').toLowerCase() === 'true' &&
    String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: enableTestSeedApi ? [AppModule, TestSeedModule] : [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());

  // Raw body support for HMAC signature verification and idempotency (same as main.ts)
  const expressApp = app.getHttpAdapter().getInstance();
  const express = require('express');
  const bodyParser = express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      // Store raw body for all requests (needed for idempotency bodyHash check)
      req.rawBody = buf;
    },
  });
  
  // Apply to all routes
  expressApp.use(bodyParser);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Match main.ts: idempotency + scope interceptors must be enabled for e2e
  app.useGlobalInterceptors(app.get(IdempotencyInterceptor));
  app.useGlobalInterceptors(app.get(ScopeInterceptor));
  await app.init();

  const request = () => supertest(app.getHttpServer());

  const loginAsAdmin = async () => {
    const res = await request()
      .post('/api/auth/login')
      .send({ email: 'admin@aos.local', password: 'Tairai123' })
      .expect(200);
    return res.body.accessToken;
  };

  /**
   * Helper to create JWT token with legalEntityId for e2e tests
   * This allows testing scope isolation without modifying the login flow
   */
  const createTokenWithLegalEntity = async (
    userId: string,
    email: string,
    role: string,
    legalEntityId: string | null,
  ): Promise<string> => {
    const { JwtService } = await import('@nestjs/jwt');
    const { ConfigService } = await import('@nestjs/config');
    const configService = app.get(ConfigService);
    const jwtService = new JwtService({
      secret: configService.get<string>('JWT_SECRET') || 'e2e-test-secret',
    });

    const payload: any = {
      email,
      sub: userId,
      role,
    };

    if (legalEntityId) {
      payload.legalEntityId = legalEntityId;
    }

    return jwtService.sign(payload, { expiresIn: '15m' });
  };

  return { app, request, loginAsAdmin, createTokenWithLegalEntity };
}
