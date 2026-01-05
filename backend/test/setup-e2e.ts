import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { TestSeedModule } from '../src/modules/devtools/test-seed/test-seed.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

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
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://aos:aos@localhost:5433/aosdb?schema=public';

  // Apply migrations
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit' });

  // Minimal seed for auth
  // IMPORTANT: PrismaClient must be generated before running e2e (handled by pnpm scripts).

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.upsert({
      where: { name: 'Admin' },
      update: {},
      create: {
        id: crypto.randomUUID(),
        name: 'Admin',
        updatedAt: new Date(),
      },
    });

    const password = await bcrypt.hash('Tairai123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@aos.local' },
      update: { password, roleId: role.id, updatedAt: new Date() },
      create: {
        id: crypto.randomUUID(),
        email: 'admin@aos.local',
        password,
        roleId: role.id,
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.init();

  const request = () => supertest(app.getHttpServer());

  const loginAsAdmin = async () => {
    const res = await request()
      .post('/api/auth/login')
      .send({ email: 'admin@aos.local', password: 'Tairai123' })
      .expect(200);
    return res.body.accessToken;
  };

  return { app, request, loginAsAdmin };
}
