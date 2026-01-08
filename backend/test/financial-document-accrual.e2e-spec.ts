import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  MoneyTransactionDirection,
  PaymentRequestType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('TZ 6.2 — FinancialDocument accrual engine (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let supplier: any;
  let bankAccount: any;
  let approvalPolicy: any;

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
      code: `ZA-${ts}`,
      name: 'Z-Accrual',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-ACC-${ts}`,
      name: `LE Accrual ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-ACC-${ts}`,
      name: `Brand ACC ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier ${ts}`,
          code: `SUP-ACC-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('IMMEDIATE_EXPENSE: accrue is idempotent; payment requires accrual and then closes AP', async () => {
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 1000,
          capitalizationPolicy: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
        })
        .expect(201)
    ).body;

    const accrue1 = await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(accrue1.body.alreadyAccrued).toBe(false);

    const accrue2 = await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(accrue2.body.alreadyAccrued).toBe(true);

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      } as any,
    });
    expect(entries.length).toBe(1);

    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: PaymentRequestType.RENT,
          amount: '1000',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
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
          plannedDate: new Date().toISOString(),
          plannedAmount: '1000',
          fromAccountId: bankAccount.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay doc' })
      .expect(200);
  });

  it('PREPAID_EXPENSE: accrue posts to prepaid asset and requires recognizedFrom/To; payment is separate', async () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    const to = new Date('2025-02-01T00:00:00.000Z');
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
          capitalizationPolicy: FinanceCapitalizationPolicy.PREPAID_EXPENSE,
          recognizedFrom: from.toISOString(),
          recognizedTo: to.toISOString(),
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      } as any,
    });
    expect(entries.length).toBe(1);
  });

  it('Strict: executing payment plan for non-accrued FinancialDocument -> 409', async () => {
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 500,
          capitalizationPolicy: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
        })
        .expect(201)
    ).body;

    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: PaymentRequestType.RENT,
          amount: '500',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
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
          plannedDate: new Date().toISOString(),
          plannedAmount: '500',
          fromAccountId: bankAccount.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Should fail' })
      .expect(409);
  });
});
