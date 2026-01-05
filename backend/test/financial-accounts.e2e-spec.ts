import { INestApplication } from '@nestjs/common';
import {
  PrismaClient,
  FinancialAccountType,
  FinancialAccountStatus,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity } from './api-seed';

describe('FinancialAccount CRUD (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZZ-${ts}`,
      name: 'Testland',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-${ts}`,
      name: `LE ${ts}`,
      countryCode: country.code,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates bank account, lists by legalEntityId, archives, and blocks duplicates by externalRef', async () => {
    const createRes = await request()
      .post('/api/finance/financial-accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: FinancialAccountType.BANK_ACCOUNT,
        currency: 'rub', // should be normalized by DTO/transform
        name: 'Main bank account',
        provider: 'Sber',
        externalRef: '40702810900000000001',
      })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.legalEntityId).toBe(legalEntity.id);
    expect(createRes.body.currency).toBe('RUB');
    expect(createRes.body.status).toBe(FinancialAccountStatus.ACTIVE);

    const listRes = await request()
      .get(`/api/finance/financial-accounts?legalEntityId=${legalEntity.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);

    const archivedRes = await request()
      .patch(`/api/finance/financial-accounts/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: FinancialAccountStatus.ARCHIVED,
      })
      .expect(200);

    expect(archivedRes.body.status).toBe(FinancialAccountStatus.ARCHIVED);

    // By default, list excludes archived
    const listActiveOnly = await request()
      .get(`/api/finance/financial-accounts?legalEntityId=${legalEntity.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listActiveOnly.body.length).toBe(0);

    // Include archived
    const listWithArchived = await request()
      .get(
        `/api/finance/financial-accounts?legalEntityId=${legalEntity.id}&includeArchived=true`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listWithArchived.body.length).toBe(1);

    // Duplicate externalRef should be rejected
    await request()
      .post('/api/finance/financial-accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: FinancialAccountType.BANK_ACCOUNT,
        currency: 'RUB',
        name: 'Duplicate',
        provider: 'Sber',
        externalRef: '40702810900000000001',
      })
      .expect(409);
  });
});
