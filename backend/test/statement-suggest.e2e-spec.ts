import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
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

describe('StatementLine suggest (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let cashflowCategory: any;
  let account: any;
  let exec: any;
  let lineId: string;

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
      code: `ZM-${ts}`,
      name: 'Z-Match',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SUG-${ts}`,
      name: `LE Suggest ${ts}`,
      countryCode: country.code,
    });

    // Needed for AccountingEntry scope resolver used by payment execution postings
    brand = await seedBrand({
      request,
      token,
      code: `BR-SUG-${ts}`,
      name: `Brand SUG ${ts}`,
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
      code: `CF-SUG-${ts}`,
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
          externalRef: `sug-${ts}`,
        })
        .expect(201)
    ).body;

    // Payment request (no financialDocument for this test; we only need execution)
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
          linkedDocId: `doc-sug-${ts}`,
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
    exec = execRes.body.paymentExecution;

    // Import statement line to match
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: `sug-${ts}`,
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
    lineId = st.body.lines[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('suggests PAYMENT_EXECUTION for matching OUT line', async () => {
    const res = await request()
      .post(`/api/finance/statement-lines/${lineId}/suggest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('SUGGESTED');
    expect(res.body.suggestedMatch).toBeDefined();
    expect(res.body.suggestedMatch.candidates.length).toBeGreaterThan(0);
    const top = res.body.suggestedMatch.candidates[0];
    expect(top.entityType).toBe('PAYMENT_EXECUTION');
    expect(top.entityId).toBe(exec.id);
  });

  it('does not suggest when amount differs', async () => {
    const ts = Date.now();
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: `sug-bad-${ts}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '9999',
            currency: 'RUB',
            description: 'Different amount',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const badLineId = st.body.lines[0].id;

    const res = await request()
      .post(`/api/finance/statement-lines/${badLineId}/suggest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('NEW');
    expect(res.body.suggestedMatch.candidates.length).toBe(0);
  });
});




