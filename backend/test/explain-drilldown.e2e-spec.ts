import { INestApplication } from '@nestjs/common';
import {
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  MoneyTransactionDirection,
  PaymentRequestType,
  StatementProvider,
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

describe('TZ 7.3 — unified explain drilldown (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let bank: any;
  let cf: any;
  let pnl: any;
  let approvalPolicy: any;

  let prepaidDoc: any;
  let paymentExecutionId: string;
  let cashflowCategoryId: string;

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
      code: `ZEX-${ts}`,
      name: 'Z-Explain',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-EX-${ts}`,
      name: `LE Explain ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-EX-${ts}`,
      name: `Brand EX ${ts}`,
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
      code: `CF-EX-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    pnl = await seedPnlCategory({
      request,
      token,
      code: `PNL-EX-${ts}`,
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

    // Opening balance entry so BS has cash
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
        amountBase: 10000,
        brandId: brand.id,
        countryId: country.id,
      })
      .expect(201);

    // Prepaid document + accrue + payment execution (gives moneyTx + cash links + entries)
    prepaidDoc = (
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
          recognizedFrom: new Date().toISOString(),
          recognizedTo: new Date(
            Date.now() + 60 * 24 * 3600 * 1000,
          ).toISOString(),
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${prepaidDoc.id}/accrue`)
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
          plannedPayDate: new Date().toISOString(),
          financialDocumentId: prepaidDoc.id,
        })
        .expect(201)
    ).body;
    cashflowCategoryId = pr.cashflowCategoryId;

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
          plannedAmount: '1200',
          fromAccountId: bank.id,
        })
        .expect(201)
    ).body;

    const execRes = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Pay prepaid' })
      .expect(200);
    paymentExecutionId = execRes.body.paymentExecution.id;

    // Acquiring event + statement line link (so BS explain can show StatementLine and AcquiringEvent)
    const stmtImport = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bank.id,
        provider: StatementProvider.ACQUIRING,
        sourceName: 'Acq',
        importHash: `explain-acq-${Date.now()}`,
        lines: [
          {
            occurredAt: new Date().toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '970',
            currency: 'RUB',
            description: 'Acquiring settlement',
          },
        ],
      })
      .expect(200);

    const st = await request()
      .get(`/api/finance/statements/${stmtImport.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const bankLineId = st.body.lines[0].id as string;

    const externalRef = `settle-${Date.now()}`;
    const evImport = await request()
      .post('/api/finance/acquiring-events/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        provider: 'TEST_ACQ',
        events: [
          {
            eventType: 'SETTLEMENT',
            occurredAt: new Date().toISOString(),
            amount: '970',
            currency: 'RUB',
            externalRef,
          },
        ],
      })
      .expect(200);

    const ev = await prisma.acquiringEvent.findFirst({
      where: {
        legalEntityId: legalEntity.id,
        provider: 'TEST_ACQ',
        externalRef,
        eventType: 'SETTLEMENT' as any,
      } as any,
      select: { id: true },
    });
    if (!ev) throw new Error('Expected acquiring event to be created');
    const settlementEventId = ev.id;

    await request()
      .post(
        `/api/finance/acquiring-events/${settlementEventId}/link-statement-line`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ statementLineId: bankLineId })
      .expect(200);

    await request()
      .post(`/api/finance/acquiring-events/${settlementEventId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('BS explain returns entry lines with primary refs including FinancialDocument, PaymentExecution, and StatementLine/AcquiringEvent', async () => {
    const at = new Date().toISOString().slice(0, 10);
    const res = await request()
      .get(
        `/api/finance/reports/explain/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}&accountId=51.00&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    const primaryTypes = new Set(
      res.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('FinancialDocument')).toBe(true);
    expect(primaryTypes.has('PaymentExecution')).toBe(true);
    expect(primaryTypes.has('StatementLine')).toBe(true);
    expect(primaryTypes.has('AcquiringEvent')).toBe(true);
  });

  it('CF explain returns moneyTx with links to entries and primary FinancialDocument', async () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = now;

    const res = await request()
      .get(
        `/api/finance/reports/explain/cashflow?legalEntityId=${legalEntity.id}&from=${from.toISOString()}&to=${to.toISOString()}&cashflowCategoryId=${cashflowCategoryId}&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const hasLinks = res.body.items.some((it: any) =>
      (it.links ?? []).some((l: any) => l.type === 'CASH'),
    );
    expect(hasLinks).toBe(true);
    const primaryTypes = new Set(
      res.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('FinancialDocument')).toBe(true);
  });

  it('Entity explain for PaymentExecution returns moneyTx + accounting entries', async () => {
    const res = await request()
      .get(
        `/api/finance/explain/entity?type=PaymentExecution&id=${paymentExecutionId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      res.body.items.some((it: any) => it.kind === 'MONEY_TRANSACTION'),
    ).toBe(true);
    expect(
      res.body.items.some((it: any) => it.kind === 'ACCOUNTING_ENTRY_LINE'),
    ).toBe(true);
  });
});
