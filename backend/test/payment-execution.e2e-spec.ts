import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  CounterpartyRole,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  PaymentPlanStatus,
  PaymentRequestStatus,
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

describe('PaymentExecution from PaymentPlan (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let cashflowCategory: any;
  let pnlCategory: any;
  let policy: any;
  let supplier: any;
  let account: any;
  let financialDocument: any;
  let paymentRequest: any;
  let plan: any;

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
      code: `ZE-${ts}`,
      name: 'Z-Exec',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-EXE-${ts}`,
      name: `LE Execution ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-EXE-${ts}`,
      name: `Brand EXE ${ts}`,
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
      code: `CF-EXE-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    pnlCategory = await seedPnlCategory({
      request,
      token,
      code: `PNL-EXE-${ts}`,
      name: 'OPEX',
    });

    policy = await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.SERVICE,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier ${ts}`,
          code: `SUP-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

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
          externalRef: `acc-${Date.now()}`,
        })
        .expect(201)
    ).body;

    financialDocument = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: 'SERVICE' as any,
          direction: 'OUT' as any,
          supplierId: supplier.id,
          currency: 'RUB',
          amountTotal: 1000,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${financialDocument.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    paymentRequest = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: PaymentRequestType.SERVICE,
          amount: '1000',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          cashflowCategoryId: cashflowCategory.id,
          financialDocumentId: financialDocument.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-requests/${paymentRequest.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/payment-requests/${paymentRequest.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);

    plan = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: paymentRequest.id,
          plannedDate: new Date().toISOString(),
          plannedAmount: '1000',
          fromAccountId: account.id,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('executes plan -> execution + moneyTx + entry + link; updates statuses; idempotent on repeat', async () => {
    const res1 = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Pay doc',
      })
      .expect(200);

    expect(
      res1.body.paymentExecution?.id ?? res1.body.paymentExecution,
    ).toBeDefined();

    const exec = await prisma.paymentExecution.findUnique({
      where: { paymentPlanId: plan.id },
    });
    expect(exec).toBeTruthy();

    const moneyTx = await prisma.moneyTransaction.findFirst({
      where: { sourceType: 'PAYMENT_EXECUTION' as any, sourceId: exec!.id },
    } as any);
    expect(moneyTx).toBeTruthy();
    expect(moneyTx!.direction).toBe('OUT');

    const entry = await prisma.accountingEntry.findFirst({
      where: { docType: AccountingDocType.PAYMENT_EXECUTION, docId: exec!.id },
    });
    expect(entry).toBeTruthy();

    const link = await prisma.cashAccountingLink.findFirst({
      where: {
        moneyTransactionId: moneyTx!.id,
        accountingEntryId: entry!.id,
        role: CashAccountingLinkRole.PAYMENT_PRINCIPAL,
      },
    });
    expect(link).toBeTruthy();

    const planDb = await prisma.paymentPlan.findUnique({
      where: { id: plan.id },
    });
    expect(planDb?.status).toBe(PaymentPlanStatus.EXECUTED);

    const prDb = await prisma.paymentRequest.findUnique({
      where: { id: paymentRequest.id },
    });
    expect(prDb?.status).toBe(PaymentRequestStatus.PAID);

    // repeat execute should not create duplicates
    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const execCount = await prisma.paymentExecution.count({
      where: { paymentPlanId: plan.id },
    });
    expect(execCount).toBe(1);
    const txCount = await prisma.moneyTransaction.count({
      where: { sourceType: 'PAYMENT_EXECUTION' as any, sourceId: exec!.id },
    } as any);
    expect(txCount).toBe(1);
    const entryCount = await prisma.accountingEntry.count({
      where: { docType: AccountingDocType.PAYMENT_EXECUTION, docId: exec!.id },
    });
    expect(entryCount).toBe(1);
  });
});
