import { INestApplication } from '@nestjs/common';
import {
  AcquiringEventType,
  AccountingDocType,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('TZ 8.4.1 — AcquiringEvent posting via PostingRun + void (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let bankAcc: any;
  let cashflowCategory: any;

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
      code: `Z84-${ts}`,
      name: 'Z-8.4',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-84-${ts}`,
      name: `LE 8.4 ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-84-${ts}`,
      name: `Brand 8.4 ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-84-${ts}`,
      name: 'E2E 8.4',
      isTransfer: false,
    });

    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank 8.4',
          provider: 'TINKOFF',
          externalRef: `bank-84-${ts}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('post creates PostingRun and entries have postingRunId; void creates reversal run/entries; repeated void is idempotent', async () => {
    const provider = 'TINKOFF';
    const t0 = new Date();
    const capturedRef = `cap-84-${Date.now()}`;

    await request()
      .post('/api/finance/acquiring-events/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        provider,
        events: [
          {
            eventType: AcquiringEventType.PAYMENT_CAPTURED,
            occurredAt: t0.toISOString(),
            amount: '1000',
            currency: 'RUB',
            externalRef: capturedRef,
          },
        ],
      })
      .expect(200);

    const ev = await prisma.acquiringEvent.findFirst({
      where: {
        legalEntityId: legalEntity.id,
        provider,
        externalRef: capturedRef,
      } as any,
    });
    expect(ev?.id).toBeDefined();

    const postRes = await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(postRes.body.postingRunId).toBeDefined();

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.ACQUIRING_EVENT,
        docId: ev!.id,
      } as any,
      orderBy: [{ lineNumber: 'asc' }],
    });
    expect(entries.length).toBe(1);
    expect(entries[0].postingRunId).toBe(postRes.body.postingRunId);

    const list = await request()
      .get(
        `/api/finance/acquiring-events?legalEntityId=${legalEntity.id}&provider=${provider}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listed = (list.body as any[]).find((x) => x.id === ev!.id);
    expect(listed).toBeTruthy();
    expect(listed.postingRunId).toBe(postRes.body.postingRunId);
    expect(listed.postingRunStatus).toBe('POSTED');

    const voidRes = await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(voidRes.body.reversalRunId).toBeDefined();

    const latestRun = await (prisma as any).accountingPostingRun.findFirst({
      where: {
        legalEntityId: legalEntity.id,
        docType: AccountingDocType.ACQUIRING_EVENT,
        docId: ev!.id,
      } as any,
      orderBy: [{ version: 'desc' }],
    });
    expect(latestRun?.id).toBe(voidRes.body.reversalRunId);

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: voidRes.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(1);
    expect(reversalEntries[0].metadata?.docLineId).toContain(
      `reversal:${postRes.body.postingRunId}`,
    );

    // second void is idempotent (no extra reversal entries)
    await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);

    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        legalEntityId: legalEntity.id,
        docType: AccountingDocType.ACQUIRING_EVENT,
        docId: ev!.id,
      } as any,
    });
    expect(runs.length).toBe(2); // original + reversal

    const reversalEntries2 = await prisma.accountingEntry.findMany({
      where: { postingRunId: voidRes.body.reversalRunId } as any,
    });
    expect(reversalEntries2.length).toBe(1);
  }, 120_000);

  it('negative: cannot void when linked statement line is POSTED', async () => {
    const provider = 'TINKOFF';
    const t0 = new Date();
    const settleRef = `set-84-${Date.now()}`;

    await request()
      .post('/api/finance/acquiring-events/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        provider,
        events: [
          {
            eventType: AcquiringEventType.SETTLEMENT,
            occurredAt: t0.toISOString(),
            amount: '100',
            currency: 'RUB',
            externalRef: settleRef,
          },
        ],
      })
      .expect(200);

    const ev = await prisma.acquiringEvent.findFirst({
      where: {
        legalEntityId: legalEntity.id,
        provider,
        externalRef: settleRef,
      } as any,
    });
    expect(ev?.id).toBeDefined();

    await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `84-void-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '100',
            currency: 'RUB',
            description: 'Settlement',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lineId = st.body.lines[0].id as string;

    const tx = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: bankAcc.id,
          occurredAt: new Date().toISOString(),
          direction: MoneyTransactionDirection.IN,
          amount: '100',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `84-void:${Date.now()}`,
          cashflowCategoryId: cashflowCategory.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: tx.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/link-statement-line`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statementLineId: lineId })
      .expect(200);

    await request()
      .post(`/api/finance/acquiring-events/${ev!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'should fail' })
      .expect(409);
  }, 120_000);
});
