import { INestApplication } from '@nestjs/common';
import {
  FinanceApprovalPolicy,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  MoneyTransactionDirection,
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

describe('TZ 7.2 — Cashflow report (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let bank: any;
  let wallet: any;
  let approvalPolicy: FinanceApprovalPolicy;

  let cfFinancing: any;
  let cfOps: any;
  let cfTransfer: any;
  let pnlOps: any;

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
      code: `ZCF-${ts}`,
      name: 'Z-CF',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-CF-${ts}`,
      name: `LE Cashflow ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-CF-${ts}`,
      name: `Brand CF ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    cfFinancing = await seedCashflowCategory({
      request,
      token,
      code: 'CF_FINANCING',
      name: 'Financing',
      isTransfer: false,
    });
    cfOps = await seedCashflowCategory({
      request,
      token,
      code: `CF-OPS-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    cfTransfer = await seedCashflowCategory({
      request,
      token,
      code: 'CF_TRANSFER_INTERNAL',
      name: 'Internal transfers',
      isTransfer: true,
    });

    pnlOps = await seedPnlCategory({
      request,
      token,
      code: `PNL-CF-${ts}`,
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

    bank = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank RUB',
          provider: 'Sber',
          externalRef: `bank-${Date.now()}`,
        })
        .expect(201)
    ).body;

    wallet = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.MARKETPLACE_WALLET,
          currency: 'RUB',
          name: 'Wallet RUB',
          provider: 'Ozon',
          externalRef: `wallet-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('cashflow report groups by category and reconciles cash delta to moneyTx net; transfers excluded only from byCategory when includeTransfers=false', async () => {
    const now = new Date();
    // Use "today" range to avoid dependency on monthly currency rates coverage in test DB
    const from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    // Opening funding: IN bank 1000 (financing)
    await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bank.id,
        occurredAt: now.toISOString(),
        direction: MoneyTransactionDirection.IN,
        amount: '1000',
        currency: 'RUB',
        cashflowCategoryId: cfFinancing.id,
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `funding-${Date.now()}`,
      })
      .expect(201);

    // Create and pay an expense (OUT bank) with ops CF category via payment execution flow
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 200,
          cashflowCategoryId: cfOps.id,
          pnlCategoryId: pnlOps.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
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
          amount: '200',
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
          plannedAmount: '200',
          fromAccountId: bank.id,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay expense' })
      .expect(200);

    // Transfer: OUT wallet / IN bank, category transfer
    const outTx = await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: wallet.id,
        occurredAt: now.toISOString(),
        direction: MoneyTransactionDirection.OUT,
        amount: '300',
        currency: 'RUB',
        cashflowCategoryId: cfTransfer.id,
        sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
        sourceId: crypto.randomUUID(),
        idempotencyKey: `tr-out-${Date.now()}`,
      })
      .expect(201);
    const inTx = await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bank.id,
        occurredAt: now.toISOString(),
        direction: MoneyTransactionDirection.IN,
        amount: '300',
        currency: 'RUB',
        cashflowCategoryId: cfTransfer.id,
        sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
        sourceId: outTx.body.sourceId,
        idempotencyKey: `tr-in-${Date.now()}`,
      })
      .expect(201);
    await request()
      .post('/api/finance/internal-transfers/post')
      .set('Authorization', `Bearer ${token}`)
      .send({
        outMoneyTransactionId: outTx.body.id,
        inMoneyTransactionId: inTx.body.id,
      })
      .expect(200);

    const cfAll = await request()
      .get(
        `/api/finance/reports/cashflow?legalEntityId=${legalEntity.id}&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&groupBy=category&includeTransfers=true`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cfAll.body.reconciliation.isReconciled).toBe(true);
    expect(Math.abs(cfAll.body.reconciliation.delta)).toBeLessThanOrEqual(
      cfAll.body.reconciliation.tolerance,
    );

    const byIdsAll = new Set(
      cfAll.body.byCategory.map((x: any) => x.cashflowCategoryId),
    );
    expect(byIdsAll.has(cfFinancing.id)).toBe(true);
    expect(byIdsAll.has(cfOps.id)).toBe(true);
    expect(byIdsAll.has(cfTransfer.id)).toBe(true);

    const cfNoTr = await request()
      .get(
        `/api/finance/reports/cashflow?legalEntityId=${legalEntity.id}&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&groupBy=category&includeTransfers=false`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cfNoTr.body.reconciliation.isReconciled).toBe(true);
    const byIdsNo = new Set(
      cfNoTr.body.byCategory.map((x: any) => x.cashflowCategoryId),
    );
    expect(byIdsNo.has(cfTransfer.id)).toBe(false);

    // explain ops category
    const explain = await request()
      .get(
        `/api/finance/reports/cashflow/explain?legalEntityId=${legalEntity.id}&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&cashflowCategoryId=${cfOps.id}&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(explain.body.total).toBeGreaterThanOrEqual(1);
  });
});
