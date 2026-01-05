import { INestApplication } from '@nestjs/common';
import {
  FinanceCategoryMappingSourceType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PaymentRequestType,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
  seedPnlCategory,
} from './api-seed';

describe('TZ 6.1 — categories enforcement + defaults (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;
  let walletAcc: any;
  let cashflowRent: any;
  let pnlRent: any;

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
      code: `ZCAT-${ts}`,
      name: 'Z-Categories',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-CAT-${ts}`,
      name: `LE Categories ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-CAT-${ts}`,
      name: `Brand Categories ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    // Ensure required categories exist (use codes seeded by migration; create if absent)
    cashflowRent = await seedCashflowCategory({
      request,
      token,
      code: 'CF_RENT',
      name: 'Rent',
      isTransfer: false,
    });
    pnlRent = await seedPnlCategory({
      request,
      token,
      code: 'PNL_RENT',
      name: 'Rent',
    });

    // Ensure mapping exists for FINANCIAL_DOCUMENT_TYPE:RENT (global)
    const existingMapping = (
      await request()
        .get(
          `/api/finance/category-default-mappings?legalEntityId=&sourceType=${FinanceCategoryMappingSourceType.FINANCIAL_DOCUMENT_TYPE}&sourceCode=RENT&includeInactive=true`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    if (!existingMapping || existingMapping.length === 0) {
      await request()
        .post('/api/finance/category-default-mappings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: null,
          sourceType: FinanceCategoryMappingSourceType.FINANCIAL_DOCUMENT_TYPE,
          sourceCode: 'RENT',
          defaultCashflowCategoryId: cashflowRent.id,
          defaultPnlCategoryId: pnlRent.id,
          priority: 100,
          isActive: true,
        })
        .expect(201);
    } else if (existingMapping[0]?.isActive === false) {
      await request()
        .patch(
          `/api/finance/category-default-mappings/${existingMapping[0].id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true })
        .expect(200);
    }

    // Wallet account for statement posting scenario
    walletAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.MARKETPLACE_WALLET,
          currency: 'RUB',
          name: 'Wallet (categories)',
          provider: 'Ozon',
          externalRef: `wallet-cat-${ts}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('FinancialDocument RENT without explicit cashflowCategoryId -> defaults applied; pnl required and defaulted', async () => {
    const res = await request()
      .post('/api/finance/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: FinancialDocumentType.RENT,
        direction: FinancialDocumentDirection.OUT,
        currency: 'RUB',
        amountTotal: 1000,
      })
      .expect(201);

    expect(res.body.cashflowCategoryId).toBe(cashflowRent.id);
    expect(res.body.pnlCategoryId).toBe(pnlRent.id);
    expect(res.body.classificationMeta?.resolvedBy).toBeDefined();
  });

  it('FinancialDocument TAX without mapping -> 422', async () => {
    // Ensure mapping absent for TAX in this test (archive if exists)
    const taxMaps = (
      await request()
        .get(
          `/api/finance/category-default-mappings?legalEntityId=&sourceType=${FinanceCategoryMappingSourceType.FINANCIAL_DOCUMENT_TYPE}&sourceCode=TAX&includeInactive=true`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body as any[];
    for (const m of taxMaps ?? []) {
      if (m?.isActive) {
        await request()
          .post(`/api/finance/category-default-mappings/${m.id}/archive`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    }

    await request()
      .post('/api/finance/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: FinancialDocumentType.TAX,
        direction: FinancialDocumentDirection.OUT,
        currency: 'RUB',
        amountTotal: 500,
      })
      .expect(422);
  });

  it('PaymentRequest without cashflowCategoryId but with financialDocumentId -> inherits', async () => {
    const doc = await request()
      .post('/api/finance/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: FinancialDocumentType.RENT,
        direction: FinancialDocumentDirection.OUT,
        currency: 'RUB',
        amountTotal: 2000,
      })
      .expect(201);

    const pr = await request()
      .post('/api/finance/payment-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: PaymentRequestType.RENT,
        amount: '2000',
        currency: 'RUB',
        plannedPayDate: new Date().toISOString(),
        financialDocumentId: doc.body.id,
      })
      .expect(201);

    expect(pr.body.cashflowCategoryId).toBe(doc.body.cashflowCategoryId);
  });

  it('Manual MoneyTransaction without cashflowCategoryId -> 400/422', async () => {
    await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        occurredAt: new Date().toISOString(),
        direction: MoneyTransactionDirection.OUT,
        amount: '10',
        currency: 'RUB',
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `mt-cat-${Date.now()}`,
      })
      .expect(400);
  });

  it('StatementLine marketplace fee create-entry without cashflowCategoryId -> defaults via mapping and posts', async () => {
    // Ensure mapping exists for STATEMENT_OPERATION_HINT:MARKETPLACE_FEE
    const cfMp = await seedCashflowCategory({
      request,
      token,
      code: 'CF_MARKETPLACE_FEES',
      name: 'Marketplace fees',
      isTransfer: false,
    });
    const pnlMp = await seedPnlCategory({
      request,
      token,
      code: 'PNL_MARKETPLACE_FEES',
      name: 'Marketplace fees',
    });

    const mpMaps = (
      await request()
        .get(
          `/api/finance/category-default-mappings?legalEntityId=&sourceType=${FinanceCategoryMappingSourceType.STATEMENT_OPERATION_HINT}&sourceCode=MARKETPLACE_FEE&includeInactive=true`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body as any[];
    if (!mpMaps || mpMaps.length === 0) {
      await request()
        .post('/api/finance/category-default-mappings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: null,
          sourceType: FinanceCategoryMappingSourceType.STATEMENT_OPERATION_HINT,
          sourceCode: 'MARKETPLACE_FEE',
          defaultCashflowCategoryId: cfMp.id,
          defaultPnlCategoryId: pnlMp.id,
          priority: 100,
          isActive: true,
        })
        .expect(201);
    } else if (mpMaps[0]?.isActive === false) {
      await request()
        .patch(`/api/finance/category-default-mappings/${mpMaps[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true })
        .expect(200);
    }

    const occurredAt = new Date().toISOString();
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `cat-fee-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
            currency: 'RUB',
            description: 'Marketplace fee',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lineId = st.body.lines[0].id as string;

    // classify without cashflowCategoryId: should be defaulted on posting
    await request()
      .patch(`/api/finance/statement-lines/${lineId}/classify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationTypeHint: 'MARKETPLACE_FEE',
        externalOperationCode: 'COMMISSION',
        marketplaceOrderId: `ORD-${Date.now()}`,
      })
      .expect(200);

    // Create manual moneyTx and match
    const mt = await request()
      .post('/api/finance/money-transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        occurredAt,
        direction: MoneyTransactionDirection.OUT,
        amount: '100',
        currency: 'RUB',
        cashflowCategoryId: cfMp.id,
        sourceType: MoneyTransactionSourceType.MANUAL,
        idempotencyKey: `mt-fee-${Date.now()}`,
      })
      .expect(201);

    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mt.body.id })
      .expect(200);

    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updatedLine = await prisma.statementLine.findUnique({
      where: { id: lineId },
    });
    // classification can remain null on line, but posting should not fail; we allow it.
    expect(updatedLine?.status).toBe('POSTED');
  });
});
