import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity } from './api-seed';

describe('MoneyTransaction + balance + idempotency (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let account: any;

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
      code: `ZT-${ts}`,
      name: 'Z-Test',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-MT-${ts}`,
      name: `LE MoneyTx ${ts}`,
      countryCode: country.code,
    });

    account = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank RUB',
          provider: 'Sber',
          externalRef: `mt-bank-${ts}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates idempotent IN, creates OUT, computes balance, rejects currency mismatch', async () => {
    const occurredAt = new Date().toISOString();
    const k1 = `k1:${Date.now()}`;

    const in1 = await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        occurredAt,
        direction: MoneyTransactionDirection.IN,
        amount: '1000',
        currency: 'RUB',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: k1,
        description: 'Initial deposit',
      })
      .expect(201);

    const in2 = await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        occurredAt,
        direction: MoneyTransactionDirection.IN,
        amount: '1000',
        currency: 'RUB',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: k1,
      })
      .expect(201);

    expect(in2.body.id).toBe(in1.body.id);

    const count = await prisma.moneyTransaction.count({
      where: { accountId: account.id, idempotencyKey: k1 },
    });
    expect(count).toBe(1);

    await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        occurredAt,
        direction: MoneyTransactionDirection.OUT,
        amount: '200',
        currency: 'RUB',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `k2:${Date.now()}`,
      })
      .expect(201);

    const balance = await request()
      .get(`/api/finance/financial-accounts/${account.id}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(balance.body.balance).toBeDefined();
    expect(Number(balance.body.balance)).toBe(800);

    // mismatch
    await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        occurredAt,
        direction: MoneyTransactionDirection.IN,
        amount: '10',
        currency: 'USD',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `k3:${Date.now()}`,
      })
      .expect(400);
  });
});

