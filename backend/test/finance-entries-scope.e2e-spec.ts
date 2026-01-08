import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from './api-seed';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

describe('TZ 5 — Finance Entries Scope Isolation (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let createTokenWithLegalEntity: (
    userId: string,
    email: string,
    role: string,
    legalEntityId: string | null,
  ) => Promise<string>;
  const prisma = new PrismaClient();

  let legalEntityA: any;
  let legalEntityB: any;
  let entryA: any;
  let entryB: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    createTokenWithLegalEntity = testApp.createTokenWithLegalEntity;

    const adminToken = await loginAsAdmin();

    // Seed two legal entities
    const countryA = await seedCountry(prisma, request(), adminToken);
    const countryB = await seedCountry(prisma, request(), adminToken);

    legalEntityA = await seedLegalEntity(
      prisma,
      request(),
      adminToken,
      countryA.id,
    );
    legalEntityB = await seedLegalEntity(
      prisma,
      request(),
      adminToken,
      countryB.id,
    );

    // Create brands and link to legal entities
    const brandA = await seedBrand(prisma, request(), adminToken);
    const brandB = await seedBrand(prisma, request(), adminToken);

    await seedBrandCountry(
      prisma,
      request(),
      adminToken,
      brandA.id,
      countryA.id,
    );
    await seedBrandCountry(
      prisma,
      request(),
      adminToken,
      brandB.id,
      countryB.id,
    );

    // Link brands to legal entities
    await prisma.brandCountry.updateMany({
      where: { brandId: brandA.id, countryId: countryA.id },
      data: { legalEntityId: legalEntityA.id },
    });
    await prisma.brandCountry.updateMany({
      where: { brandId: brandB.id, countryId: countryB.id },
      data: { legalEntityId: legalEntityB.id },
    });

    // Create accounting entries for each legal entity
    entryA = await prisma.accountingEntry.create({
      data: {
        id: crypto.randomUUID(),
        legalEntityId: legalEntityA.id,
        countryId: countryA.id,
        brandId: brandA.id,
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: crypto.randomUUID(),
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount: '10.01',
        creditAccount: '60.01',
        amount: '1000',
        currency: 'RUB',
        amountBase: '1000',
        description: 'Entry for Legal Entity A',
      } as any,
    });

    entryB = await prisma.accountingEntry.create({
      data: {
        id: crypto.randomUUID(),
        legalEntityId: legalEntityB.id,
        countryId: countryB.id,
        brandId: brandB.id,
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: crypto.randomUUID(),
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount: '10.01',
        creditAccount: '60.01',
        amount: '2000',
        currency: 'RUB',
        amountBase: '2000',
        description: 'Entry for Legal Entity B',
      } as any,
    });

    // Create users for each legal entity
    const role = await prisma.role.findFirst({
      where: { name: 'FinanceManager' },
    });
    if (!role) {
      throw new Error('FinanceManager role not found');
    }

    userA = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `user-a-finance-${Date.now()}@test.com`,
        password: await bcrypt.hash('password', 10),
        roleId: role.id,
      },
    });

    userB = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `user-b-finance-${Date.now()}@test.com`,
        password: await bcrypt.hash('password', 10),
        roleId: role.id,
      },
    });

    // Create JWT tokens with legalEntityId for each user
    tokenA = await createTokenWithLegalEntity(
      userA.id,
      userA.email,
      'FinanceManager',
      legalEntityA.id,
    );
    tokenB = await createTokenWithLegalEntity(
      userB.id,
      userB.email,
      'FinanceManager',
      legalEntityB.id,
    );
  });

  afterAll(async () => {
    if (app) {
      if (app) await app.close();
    }
    await prisma.$disconnect();
  });

  // NOTE: We intentionally test scope isolation via real HTTP endpoints (JwtAuthGuard + ScopeInterceptor + Prisma middleware),
  // not by running Prisma queries in-process, because scope is request-context-bound.

  it('should filter accounting entries through API endpoint - userA sees only entryA', async () => {
    // Test through API endpoint (which uses Prisma with scope middleware)
    const entriesResponse = await request()
      .get('/api/finance/accounting-entries')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ docType: AccountingDocType.SUPPLY_RECEIPT })
      .expect(200);

    // AccountingEntryService.list() returns array directly
    const entries = Array.isArray(entriesResponse.body)
      ? entriesResponse.body
      : entriesResponse.body.items || [];
    const entryIds = entries.map((e: any) => e.id);

    // User A should only see entryA
    expect(entryIds).toContain(entryA.id);
    expect(entryIds).not.toContain(entryB.id);
  });

  it('should filter accounting entries through API endpoint - userB sees only entryB', async () => {
    const entriesResponse = await request()
      .get('/api/finance/accounting-entries')
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ docType: AccountingDocType.SUPPLY_RECEIPT })
      .expect(200);

    const entries = Array.isArray(entriesResponse.body)
      ? entriesResponse.body
      : entriesResponse.body.items || [];
    const entryIds = entries.map((e: any) => e.id);

    // User B should only see entryB
    expect(entryIds).toContain(entryB.id);
    expect(entryIds).not.toContain(entryA.id);
  });
});

