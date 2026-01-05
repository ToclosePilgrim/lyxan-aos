import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  FinanceApprovalPolicy,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  MoneyTransactionSourceType,
  PaymentRequestType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
  seedPnlCategory,
} from './api-seed';

describe('TZ 7.1 — Balance Sheet report (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let bankAccount: any;
  let cf: any;
  let pnl: any;
  let approvalPolicy: FinanceApprovalPolicy;

  beforeAll(async () => {
    process.env.ENABLE_TEST_SEED_API = 'true';
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZBS-${ts}`,
      name: 'Z-BS',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-BS-${ts}`,
      name: `LE Balance ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-BS-${ts}`,
      name: `Brand BS ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    cf = await seedCashflowCategory({
      request,
      token,
      code: `CF-BS-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    pnl = await seedPnlCategory({
      request,
      token,
      code: `PNL-BS-${ts}`,
      name: 'OPEX',
    });

    approvalPolicy = await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.RENT,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });

    bankAccount = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank RUB',
          provider: 'Sber',
          externalRef: `acc-${Date.now()}`,
        })
        .expect(201)
    ).body;

    // Opening balance: Dr Cash / Cr Equity capital (seed via admin API, idempotent by docLineId)
    const now = new Date();
    await request()
      .post('/api/devtools/test-seed/accounting-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        postingDate: now.toISOString(),
        seedId: `seed:${legalEntity.id}`,
        docLineId: `opening:${legalEntity.id}`,
        debitAccount: '51.00',
        creditAccount: '80.01',
        amount: 10000,
        currency: 'RUB',
        description: 'Opening balance',
        amountBase: 10000,
        brandId: brand.id,
        countryId: country.id,
      })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('returns balance sheet with equation check and explain drilldown', async () => {
    // Prepaid accrual and payment to introduce AP/Prepaid/Cash movements (all BS-only entries)
    const now = new Date();
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 1200,
          cashflowCategoryId: cf.id,
          pnlCategoryId: pnl.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.PREPAID_EXPENSE,
          recognizedFrom: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
          ).toISOString(),
          recognizedTo: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1) - 1,
          ).toISOString(),
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: PaymentRequestType.RENT,
          amount: '1200',
          currency: 'RUB',
          plannedPayDate: now.toISOString(),
          financialDocumentId: doc.id,
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
          plannedDate: now.toISOString(),
          plannedAmount: '1200',
          fromAccountId: bankAccount.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay prepaid' })
      .expect(200);

    const at = new Date().toISOString().slice(0, 10);
    const bs = await request()
      .get(
        `/api/finance/reports/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(bs.body.legalEntityId).toBe(legalEntity.id);
    expect(bs.body.sections.assets.total).toBeDefined();
    expect(bs.body.sections.liabilities.total).toBeDefined();
    expect(bs.body.sections.equity.total).toBeDefined();
    expect(Math.abs(bs.body.checks.equationDelta)).toBeLessThanOrEqual(
      bs.body.checks.tolerance,
    );
    expect(bs.body.checks.isBalanced).toBe(true);

    // Drilldown: explain cash equivalents should return opening + payment
    const explain = await request()
      .get(
        `/api/finance/reports/balance-sheet/explain?legalEntityId=${legalEntity.id}&at=${at}&accountId=51.00&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(explain.body.total).toBeGreaterThanOrEqual(2);
    expect(
      explain.body.items.some(
        (e: any) => e.docLineId && String(e.docLineId).startsWith('opening:'),
      ),
    ).toBe(true);
  });
});
