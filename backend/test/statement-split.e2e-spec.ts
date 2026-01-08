import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  Prisma,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity } from './api-seed';

describe('StatementLine split (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let account: any;
  let parentLineId: string;

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
      code: `ZSPL-${ts}`,
      name: 'Z-Split',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SPL-${ts}`,
      name: `LE Split ${ts}`,
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
          externalRef: `split-${Date.now()}`,
        })
        .expect(201)
    ).body;

    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-split-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout aggregated',
          },
        ],
      })
      .expect(200);

    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    parentLineId = st.body.lines[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('splits parent into children; parent becomes SPLIT; parent cannot confirm/post; undoSplit works', async () => {
    const splitRes = await request()
      .post(`/api/finance/statement-lines/${parentLineId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        splits: [
          { amount: '600.00', description: 'Invoice A' },
          { amount: '400.00', description: 'Invoice B' },
        ],
        forceSuggested: false,
      })
      .expect(200);

    expect(splitRes.body.parentLineId).toBe(parentLineId);
    expect(splitRes.body.childrenIds.length).toBe(2);

    const parent = await prisma.statementLine.findUnique({
      where: { id: parentLineId },
    });
    expect(parent?.status).toBe('SPLIT');
    expect((parent as any)?.isSplitParent).toBe(true);

    const children = await prisma.statementLine.findMany({
      where: { parentLineId },
      orderBy: { lineIndex: 'asc' },
    });
    expect(children.length).toBe(2);
    expect(children[0].parentLineId).toBe(parentLineId);
    expect(children[0].currency).toBe(parent!.currency);
    expect(children[0].direction).toBe(parent!.direction);
    const sum = children.reduce(
      (acc, c) => acc.add(c.amount as any),
      new Prisma.Decimal(0),
    );
    // Compare via string because Prisma Decimal instance type differs in runtime
    expect(sum.toString()).toBe((parent!.amount as any).toString());

    await request()
      .post(`/api/finance/statement-lines/${parentLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    await request()
      .post(`/api/finance/statement-lines/${parentLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: crypto.randomUUID() })
      .expect(409);

    await request()
      .post(`/api/finance/statement-lines/${parentLineId}/undo-split`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const childrenAfter = await prisma.statementLine.count({
      where: { parentLineId },
    });
    expect(childrenAfter).toBe(0);
    const parentAfter = await prisma.statementLine.findUnique({
      where: { id: parentLineId },
    });
    expect(parentAfter?.status).toBe('NEW');
    expect((parentAfter as any)?.isSplitParent).toBe(false);
  });

  it('rejects split when sums do not match', async () => {
    // create a new parent line
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-split-bad-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Bad split',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const badParentId = st.body.lines[0].id;

    await request()
      .post(`/api/finance/statement-lines/${badParentId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        splits: [{ amount: '600.00' }, { amount: '300.00' }],
      })
      .expect(400);
  });

  it('rejects split for POSTED parent', async () => {
    // create a new parent line and POST it via public APIs (no DB hacks)
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-split-posted-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Posted split',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const postedParentId = st.body.lines[0].id;

    const tx = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: account.id,
          occurredAt: new Date().toISOString(),
          direction: MoneyTransactionDirection.OUT,
          amount: '1000',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `split-posted:${Date.now()}`,
          description: 'Match posted line',
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/statement-lines/${postedParentId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: tx.id })
      .expect(200);

    await request()
      .post(`/api/finance/statement-lines/${postedParentId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/finance/statement-lines/${postedParentId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        splits: [{ amount: '600.00' }, { amount: '400.00' }],
      })
      .expect(409);
  });
});
