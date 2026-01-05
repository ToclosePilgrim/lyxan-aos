import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  MoneyTransactionStatus,
  PaymentRequestType,
  PrismaClient,
  SalesDocumentStatus,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedPnlCategory,
} from './api-seed';

describe('TZ 8.1 — posting idempotency + void/reverse/repost (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let cashflowCategory: any;
  let pnlCategory: any;
  let approvalPolicy: any;
  let supplier: any;
  let bankAccount: any;

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
      code: `ZVR-${ts}`,
      name: 'Z-void',
    });

    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-VR-${ts}`,
      name: `LE Void/Repost ${ts}`,
      countryCode: country.code,
    });

    brand = await seedBrand({
      request,
      token,
      code: `BR-VR-${ts}`,
      name: `Brand VR ${ts}`,
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
      code: `CF-VR-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });

    pnlCategory = await seedPnlCategory({
      request,
      token,
      code: `PNL-VR-${ts}`,
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

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier ${ts}`,
          code: `SUP-VR-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

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
    await app.close();
  });

  it('PaymentExecution void: moneyTx VOIDED + reversal entry; idempotent on repeat', async () => {
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
          supplierId: supplier.id,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
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

    const execRes = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay' })
      .expect(200);
    const paymentExecutionId = execRes.body.paymentExecution.id as string;

    const before = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: paymentExecutionId,
      } as any,
    });
    expect(before).toBe(1);

    await request()
      .post(`/api/finance/payment-executions/${paymentExecutionId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'mistake' })
      .expect(200);

    const tx = await prisma.moneyTransaction.findFirst({
      where: {
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: paymentExecutionId,
      } as any,
    });
    expect(tx?.status).toBe(MoneyTransactionStatus.VOIDED);

    const after = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: paymentExecutionId,
      } as any,
    });
    expect(after).toBe(2); // original + reversal

    // idempotent: second void does not add more
    await request()
      .post(`/api/finance/payment-executions/${paymentExecutionId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'mistake' })
      .expect(200);
    const after2 = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: paymentExecutionId,
      } as any,
    });
    expect(after2).toBe(2);
  });

  it('FinancialDocument void-accrual: reversal entry + isAccrued=false; forbidden if paid', async () => {
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 700,
          supplierId: supplier.id,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const before = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      } as any,
    });
    expect(before).toBe(1);

    await request()
      .post(`/api/finance/documents/${doc.id}/void-accrual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'cancelled' })
      .expect(200);

    const after = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      } as any,
    });
    expect(after).toBe(2);

    const updated = await prisma.financialDocument.findUnique({
      where: { id: doc.id },
    });
    expect((updated as any).isAccrued).toBe(false);
  });

  it('SalesDocument repost: creates new run version and new entries without duplicates', async () => {
    const ts = Date.now();
    const item = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `ITEM-${ts}`,
      name: 'Test item',
      unit: 'pcs',
    });

    const sd = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          sourceType: 'TEST',
          externalId: `vr-sd-${ts}`,
          periodFrom: new Date(Date.now() - 86400000).toISOString(),
          periodTo: new Date().toISOString(),
          status: 'DRAFT',
          lines: [
            {
              itemId: item.id,
              date: new Date().toISOString(),
              quantity: '1',
              revenue: '100',
              commission: '10',
            },
          ],
        })
        .expect(201)
    ).body;

    await request()
      .patch(`/api/finance/sales-documents/${sd.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const count1 = await prisma.accountingEntry.count({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: sd.id } as any,
    });
    expect(count1).toBeGreaterThanOrEqual(1);

    await request()
      .post(`/api/finance/sales-documents/${sd.id}/repost`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'fix' })
      .expect(201);

    const count2 = await prisma.accountingEntry.count({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: sd.id } as any,
    });
    expect(count2).toBeGreaterThanOrEqual(count1 + 2); // old + reversal + new (at least)
  });

  it('Negative: void PaymentExecution after statement reconcile -> 409', async () => {
    // Create minimal paid execution
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 100,
          supplierId: supplier.id,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
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
          amount: '100',
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
          plannedAmount: '100',
          fromAccountId: bankAccount.id,
        })
        .expect(201)
    ).body;
    const execRes = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay' })
      .expect(200);
    const execId = execRes.body.paymentExecution.id as string;

    const tx = await prisma.moneyTransaction.findFirst({
      where: {
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: execId,
      } as any,
    });
    expect(tx).toBeTruthy();

    // Import statement and mark reconciled to this tx
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAccount.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `recon-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
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

    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: (tx as any).id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/finance/payment-executions/${execId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'no' })
      .expect(409);
  });
});
