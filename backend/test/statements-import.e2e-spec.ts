import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  PrismaClient,
  StatementLineStatus,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity } from './api-seed';

describe('Statements import (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let account: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      code: `ZS-${ts}`,
      name: 'Z-Statements',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-ST-${ts}`,
      name: `LE Statements ${ts}`,
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
          externalRef: `st-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('imports 3 lines; reimport same batch is idempotent; line-level dedup works; currency mismatch is 400', async () => {
    const now = new Date();
    const l1 = {
      occurredAt: new Date(now.getTime() - 60_000).toISOString(),
      direction: MoneyTransactionDirection.IN,
      amount: '100',
      currency: 'RUB',
      description: 'Incoming 1',
      externalLineId: 'ext-1',
    };
    const l2 = {
      occurredAt: new Date(now.getTime() - 50_000).toISOString(),
      direction: MoneyTransactionDirection.OUT,
      amount: '10',
      currency: 'RUB',
      description: 'Fee',
      bankReference: 'BR-1',
    };
    const l3 = {
      occurredAt: new Date(now.getTime() - 40_000).toISOString(),
      direction: MoneyTransactionDirection.IN,
      amount: '200',
      currency: 'RUB',
      description: 'Incoming 2',
      bankReference: 'BR-2',
    };

    const imp1 = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: 'h1',
        lines: [l1, l2, l3],
      })
      .expect(200);

    expect(imp1.body.statementId).toBeDefined();
    expect(imp1.body.createdLines).toBe(3);

    const stmtId = imp1.body.statementId;
    const linesDb = await prisma.statementLine.findMany({
      where: { statementId: stmtId },
      orderBy: { lineIndex: 'asc' },
    });
    expect(linesDb.length).toBe(3);
    expect(linesDb[0].status).toBe(StatementLineStatus.NEW);
    expect(linesDb[0].amountBase).toBeDefined();

    // Reimport same batch (same importHash) -> no new lines
    const imp1b = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: 'h1',
        lines: [l1, l2, l3],
      })
      .expect(200);
    expect(imp1b.body.alreadyImported).toBe(true);
    expect(imp1b.body.createdLines).toBe(0);

    // Second batch with 1 duplicate by externalLineId and 2 new
    const l4dup = { ...l1, description: 'Incoming 1 DUP' }; // same externalLineId ext-1
    const l5 = {
      occurredAt: new Date(now.getTime() - 30_000).toISOString(),
      direction: MoneyTransactionDirection.OUT,
      amount: '20',
      currency: 'RUB',
      description: 'Payment',
      externalLineId: 'ext-5',
    };
    const l6 = {
      occurredAt: new Date(now.getTime() - 20_000).toISOString(),
      direction: MoneyTransactionDirection.IN,
      amount: '300',
      currency: 'RUB',
      description: 'Incoming 3',
    };

    const imp2 = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: 'h2',
        lines: [l4dup, l5, l6],
      })
      .expect(200);

    expect(imp2.body.createdLines).toBe(2);

    const totalLines = await prisma.statementLine.count({
      where: { accountId: account.id },
    });
    expect(totalLines).toBe(5);

    // Currency mismatch -> 400
    await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: 'h3',
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '1',
            currency: 'USD',
          },
        ],
      })
      .expect(400);

    const stmtId = imp1.body.statementId;
    const linesDb = await prisma.statementLine.findMany({
      where: { statementId: stmtId },
      orderBy: { lineIndex: 'asc' },
    });
    expect(linesDb.length).toBe(3);
    expect(linesDb[0].status).toBe(StatementLineStatus.NEW);
    expect(linesDb[0].amountBase).toBeDefined();

    // Reimport same batch (same importHash) -> no new lines
    const imp1b = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: 'h1',
        lines: [l1, l2, l3],
      })
      .expect(200);
    expect(imp1b.body.alreadyImported).toBe(true);
    expect(imp1b.body.createdLines).toBe(0);

    // Second batch with 1 duplicate by externalLineId and 2 new
    const l4dup = { ...l1, description: 'Incoming 1 DUP' }; // same externalLineId ext-1
    const l5 = {
      occurredAt: new Date(now.getTime() - 30_000).toISOString(),
      direction: MoneyTransactionDirection.OUT,
      amount: '20',
      currency: 'RUB',
      description: 'Payment',
      externalLineId: 'ext-5',
    };
    const l6 = {
      occurredAt: new Date(now.getTime() - 20_000).toISOString(),
      direction: MoneyTransactionDirection.IN,
      amount: '300',
      currency: 'RUB',
      description: 'Incoming 3',
    };

    const imp2 = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: 'h2',
        lines: [l4dup, l5, l6],
      })
      .expect(200);

    expect(imp2.body.createdLines).toBe(2);

    const totalLines = await prisma.statementLine.count({
      where: { accountId: account.id },
    });
    expect(totalLines).toBe(5);

    // Currency mismatch -> 400
    await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: 'h3',
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '1',
            currency: 'USD',
          },
        ],
      })
      .expect(400);
  });
});
