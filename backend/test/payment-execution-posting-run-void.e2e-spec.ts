import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  CounterpartyRole,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PaymentPlanStatus,
  PaymentRequestStatus,
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
  seedPnlCategory,
} from './api-seed';

describe('TZ 8.4.3.4 — PaymentExecution PostingRun + void (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let cashflowCategory: any;
  let pnlCategory: any;
  let supplier: any;
  let bankAccount: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZPE-${ts}`,
      name: 'Z-PE',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PE-${ts}`,
      name: `LE PE ${ts}`,
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token,
      code: `BR-PE-${ts}`,
      name: `Brand PE ${ts}`,
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
      code: `CF-PE-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    pnlCategory = await seedPnlCategory({
      request,
      token,
      code: `PNL-PE-${ts}`,
      name: 'OPEX',
    });

    await seedApprovalPolicy({
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
          code: `SUP-PE-${ts}`,
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
          externalRef: `acc-pe-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function createPaidExecution(amount: string) {
    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: 'RENT' as any,
          direction: 'OUTGOING' as any,
          currency: 'RUB',
          amountTotal: Number(amount),
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
          amount,
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          financialDocumentId: doc.id,
          cashflowCategoryId: cashflowCategory.id,
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
          plannedAmount: amount,
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

    const mt = await prisma.moneyTransaction.findFirst({
      where: {
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: execId,
      } as any,
    });
    expect(mt?.id).toBeTruthy();

    const entry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: execId,
      } as any,
    });
    expect(entry?.postingRunId).toBeTruthy();
    expect((entry as any)?.metadata?.docLineId).toBe(
      `payment_execution:${execId}:principal`,
    );

    const link = await prisma.cashAccountingLink.findFirst({
      where: {
        moneyTransactionId: mt!.id,
        accountingEntryId: entry!.id,
        role: CashAccountingLinkRole.PAYMENT_PRINCIPAL,
      } as any,
    });
    expect(link).toBeTruthy();

    return {
      doc,
      pr,
      plan,
      execId,
      moneyTxId: mt!.id,
      postingRunId: entry!.postingRunId,
    };
  }

  it('execute -> entries have postingRunId; void creates reversal; repeated void is idempotent; statuses rollback', async () => {
    const { pr, plan, execId, moneyTxId } = await createPaidExecution('100');

    // void
    const v1 = await request()
      .post(`/api/finance/payment-executions/${execId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(v1.body.reversalRunId ?? null).not.toBeUndefined();

    // repeated void: should not create new reversal
    const v2 = await request()
      .post(`/api/finance/payment-executions/${execId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(v2.body.reversalRunId ?? null).not.toBeUndefined();

    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: execId,
      } as any,
    });
    expect(runs.length).toBe(2);

    const mtAfter = await prisma.moneyTransaction.findUnique({
      where: { id: moneyTxId },
    });
    expect((mtAfter as any).status).toBe('VOIDED');

    const execAfter = await prisma.paymentExecution.findUnique({
      where: { id: execId },
    });
    expect(execAfter?.status).toBe('CANCELED');

    const planAfter = await prisma.paymentPlan.findUnique({
      where: { id: plan.id },
    });
    expect(planAfter?.status).toBe(PaymentPlanStatus.CANCELED);

    const prAfter = await prisma.paymentRequest.findUnique({
      where: { id: pr.id },
    });
    expect(prAfter?.status).toBe(PaymentRequestStatus.APPROVED);
  }, 120_000);

  it('negative: reconcile execution moneyTx to POSTED statement line -> void = 409', async () => {
    const { execId, moneyTxId } = await createPaidExecution('100');

    // import bank statement OUT and reconcile to the execution moneyTx
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAccount.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `recon-pe-${Date.now()}`,
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
      .send({ entityType: 'MONEY_TRANSACTION', entityId: moneyTxId })
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
  }, 120_000);

  it('repost: voids old execution and creates a new plan+execution (new ids)', async () => {
    const { execId } = await createPaidExecution('100');

    const repost = await request()
      .post(`/api/finance/payment-executions/${execId}/repost`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'fix bank ref' })
      .expect(201);

    expect(repost.body.oldPaymentExecutionId).toBe(execId);
    expect(repost.body.newPaymentPlanId).toBeTruthy();
    expect(repost.body.newPaymentExecutionId).toBeTruthy();
    expect(repost.body.newPaymentExecutionId).not.toBe(execId);

    const oldExec = await prisma.paymentExecution.findUnique({
      where: { id: execId },
    });
    expect(oldExec?.status).toBe('CANCELED');

    const newExec = await prisma.paymentExecution.findUnique({
      where: { id: repost.body.newPaymentExecutionId },
    });
    expect(newExec?.status).toBe('EXECUTED');

    const newEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: newExec!.id,
      } as any,
    });
    expect(newEntry?.postingRunId).toBeTruthy();
  }, 120_000);
});
