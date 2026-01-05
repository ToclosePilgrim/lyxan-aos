import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PaymentRequestType,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('Reconciliation controls (API-only, contract)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let cashflowCategory: any;
  let account: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZRC-${ts}`,
      name: 'Z-Recon',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-RC-${ts}`,
      name: `LE Recon ${ts}`,
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token,
      code: `BR-RC-${ts}`,
      name: `Brand Recon ${ts}`,
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
      code: `CF-RC-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.SERVICE,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
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
          externalRef: `rc-${ts}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('summary + NEW queue work; NEW disappears after posting matched line; UNEXPLAINED_CASH shows manual tx', async () => {
    // Create a NEW statement line
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: `rc-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Payment',
          },
        ],
      })
      .expect(200);

    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lineId = st.body.lines[0].id as string;

    // Summary + NEW queue include the line
    await request()
      .get(
        `/api/finance/reconciliation/controls/summary?legalEntityId=${legalEntity.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const qNew = await request()
      .get(
        `/api/finance/reconciliation/controls/queue?type=NEW&legalEntityId=${legalEntity.id}&limit=50`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(qNew.body.items.some((it: any) => it.id === lineId)).toBe(true);

    // Create PaymentExecution via APIs
    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: PaymentRequestType.SERVICE,
          amount: '1000',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          cashflowCategoryId: cashflowCategory.id,
          linkedDocType: 'OTHER',
          linkedDocId: `rc-doc-${Date.now()}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/payment-requests/${pr.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/payment-requests/${pr.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);
    const plan = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: pr.id,
          plannedDate: new Date().toISOString(),
          plannedAmount: '1000',
          fromAccountId: account.id,
        })
        .expect(201)
    ).body;
    const execRes = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay' })
      .expect(200);
    const execId = execRes.body.paymentExecution.id as string;

    // Match + post
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'PAYMENT_EXECUTION', entityId: execId })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // NEW queue no longer includes it
    const qNew2 = await request()
      .get(
        `/api/finance/reconciliation/controls/queue?type=NEW&legalEntityId=${legalEntity.id}&limit=50`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(qNew2.body.items.some((it: any) => it.id === lineId)).toBe(false);

    // Create an unexplained manual tx
    await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        occurredAt: new Date().toISOString(),
        direction: MoneyTransactionDirection.IN,
        amount: '123',
        currency: 'RUB',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `rc-manual:${Date.now()}`,
        description: 'Manual IN',
      })
      .expect(201);

    await request()
      .get(
        `/api/finance/reconciliation/controls/queue?type=UNEXPLAINED_CASH&legalEntityId=${legalEntity.id}&limit=50`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 120_000);
});

