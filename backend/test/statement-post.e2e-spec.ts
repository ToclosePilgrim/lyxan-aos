import { INestApplication } from '@nestjs/common';
import {
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PaymentRequestType,
  PrismaClient,
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
} from './api-seed';

describe('StatementLine confirm-match + post (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let cashflowCategory: any;
  let policy: any;
  let account: any;
  let pr: any;
  let plan: any;
  let exec: any;
  let execMoneyTx: any;
  let execEntry: any;
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
      code: `ZP-${ts}`,
      name: 'Z-Post',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-POST-${ts}`,
      name: `LE Post ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-POST-${ts}`,
      name: `Brand Post ${ts}`,
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
      code: `CF-POST-${ts}`,
      name: 'Ops',
      isTransfer: false,
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
          externalRef: `post-${Date.now()}`,
        })
        .expect(201)
    ).body;

    pr = (
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
          linkedDocId: 'doc-post',
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

    plan = (
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

    const bankRef = `BR-POST-${Date.now()}`;
    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bankReference: bankRef, description: `Pay ${bankRef}` })
      .expect(200);

    exec = await prisma.paymentExecution.findUnique({
      where: { paymentPlanId: plan.id },
    });
    expect(exec).toBeTruthy();

    execMoneyTx = await prisma.moneyTransaction.findFirst({
      where: {
        accountId: account.id,
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: exec.id,
      } as any,
    });
    expect(execMoneyTx).toBeTruthy();

    execEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: 'PAYMENT_EXECUTION' as any,
        docId: exec.id,
        metadata: {
          path: ['docLineId'],
          equals: `payment_execution:${exec.id}:principal`,
        } as any,
      } as any,
    });
    expect(execEntry).toBeTruthy();

    // Import statement line matching execution
    const occurredAt = new Date(exec.executedAt);
    occurredAt.setUTCDate(occurredAt.getUTCDate()); // same day
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-post-${Date.now()}`,
        lines: [
          {
            occurredAt: occurredAt.toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            bankReference: bankRef,
            description: `Payment ${bankRef}`,
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    lineId = st.body.lines[0].id;

    // Confirm match manually
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'PAYMENT_EXECUTION', entityId: exec.id })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('posts matched execution line and is idempotent on repeat', async () => {
    const res = await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.line.status).toBe('POSTED');
    expect(res.body.line.postedMoneyTransactionId).toBe(execMoneyTx.id);

    const links = await prisma.cashAccountingLink.findMany({
      where: { moneyTransactionId: execMoneyTx.id },
    });
    const has = links.some(
      (l) =>
        l.accountingEntryId === execEntry.id && l.role === 'PAYMENT_PRINCIPAL',
    );
    expect(has).toBe(true);

    // Repeat post -> no duplicates
    const beforeCount = await prisma.cashAccountingLink.count({
      where: {
        moneyTransactionId: execMoneyTx.id,
        accountingEntryId: execEntry.id,
        role: 'PAYMENT_PRINCIPAL' as any,
      },
    });
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterCount = await prisma.cashAccountingLink.count({
      where: {
        moneyTransactionId: execMoneyTx.id,
        accountingEntryId: execEntry.id,
        role: 'PAYMENT_PRINCIPAL' as any,
      },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it('rejects post without MATCHED', async () => {
    // Import a NEW line but do not confirm-match
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-new-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '5',
            currency: 'RUB',
            description: 'Unmatched',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const newLineId = st.body.lines[0].id;

    await request()
      .post(`/api/finance/statement-lines/${newLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('rejects confirm-match with entity from another legal entity', async () => {
    const ts = Date.now();
    const otherLe = await seedLegalEntity({
      request,
      token,
      code: `LE-OTHER-${ts}`,
      name: `Other ${ts}`,
      countryCode: country.code,
    });
    await seedApprovalPolicy({
      request,
      token,
      legalEntityId: otherLe.id,
      type: PaymentRequestType.SERVICE,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });
    const otherAccount = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: otherLe.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank OTHER',
          provider: 'Sber',
          externalRef: `post-other-${ts}`,
        })
        .expect(201)
    ).body;

    const otherReq = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: otherLe.id,
          type: PaymentRequestType.SERVICE,
          amount: '1000',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          cashflowCategoryId: cashflowCategory.id,
          linkedDocType: 'OTHER',
          linkedDocId: `doc-other-${ts}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/payment-requests/${otherReq.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/payment-requests/${otherReq.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);
    const otherPlan = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: otherReq.id,
          plannedDate: new Date().toISOString(),
          plannedAmount: '1000',
          fromAccountId: otherAccount.id,
        })
        .expect(201)
    ).body;
    const otherExecRes = await request()
      .post(`/api/finance/payment-plans/${otherPlan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Other exec' })
      .expect(200);
    const otherExec = otherExecRes.body.paymentExecution;

    // Create a fresh NEW statement line (so status check doesn't block)
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.id,
        provider: StatementProvider.BANK,
        importHash: `hash-other-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Line to mismatch legal entity',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const freshLineId = st.body.lines[0].id;

    await request()
      .post(`/api/finance/statement-lines/${freshLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'PAYMENT_EXECUTION', entityId: otherExec.id })
      .expect(400);
  });
});
