import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
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
  seedMarketplace,
  seedMdmItem,
} from './api-seed';

describe('Marketplace fee anti-double-count (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let walletAcc: any;
  let feeCashflowCategory: any;
  let marketplace: any;
  let item: any;

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
      code: 'ZMF',
      name: 'Z-MP-FEE',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-MPF-${ts}`,
      name: `LE MP Fee ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-MPF-${ts}`,
      name: `Brand MP Fee ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    feeCashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `MARKETPLACE_FEES_${ts}`,
      name: 'Marketplace fees',
      isTransfer: false,
    });

    walletAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.MARKETPLACE_WALLET,
          currency: 'RUB',
          name: 'Ozon wallet (fees)',
          provider: 'Ozon',
          externalRef: `wallet-fees-${Date.now()}`,
        })
        .expect(201)
    ).body;

    marketplace = await seedMarketplace({
      request,
      token,
      code: 'OZON',
      name: 'Ozon',
    });
    item = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      name: `Item MP Fee ${ts}`,
      code: `ITEM-MPF-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('Scenario A: fee already in ledger -> links to existing entry (no double-count)', async () => {
    const occurredAt = new Date().toISOString();
    const orderId = `ORD-${Date.now()}`;
    const feeCode = 'COMMISSION';

    // Create SalesDocument via public API (fee entry must come from SalesDocument posting)
    const sd = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: marketplace.id,
          sourceType: 'E2E',
          externalId: `sd-fee-a:${orderId}`,
          periodFrom: occurredAt,
          periodTo: occurredAt,
          status: 'IMPORTED',
          lines: [
            {
              itemId: item.id,
              date: occurredAt,
              quantity: '1',
              revenue: '0',
              commission: '100',
              refunds: '0',
              cogsAmount: '0',
              meta: { marketplace: { orderId, operationId: null, feeCode } },
            },
          ],
        })
        .expect(201)
    ).body;

    // Post SalesDocument => should generate existing fee AccountingEntry with standardized metadata.marketplace.*
    await request()
      .patch(`/api/finance/sales-documents/${sd.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const existingEntries = await prisma.accountingEntry.findMany({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: sd.id } as any,
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(existingEntries.length).toBeGreaterThan(0);
    const existingEntry =
      existingEntries.find((e) => (e as any).debitAccount === '90.02.1') ??
      existingEntries[0];
    const mpMeta = (existingEntry as any)?.metadata?.marketplace ?? null;
    expect(mpMeta?.provider).toBe('OZON');
    expect(mpMeta?.orderId).toBe(orderId);
    expect(mpMeta?.feeCode).toBe(feeCode);
    expect(typeof mpMeta?.feeKey).toBe('string');
    expect(String(mpMeta.feeKey)).toContain(`OZON:${feeCode}:`);

    // Import statement line on wallet (OUT)
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `mp-fee-a-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
            currency: 'RUB',
            description: 'Commission удержание',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lineId = st.body.lines[0].id as string;

    // Classify line as fee (no cashflowCategoryId needed when linking existing entry)
    const feeKey = (existingEntry as any)?.metadata?.marketplace
      ?.feeKey as string;
    await request()
      .patch(`/api/finance/statement-lines/${lineId}/classify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationTypeHint: 'FEE',
        externalOperationCode: feeCode,
        marketplaceOrderId: orderId,
        saleDocumentId: sd.id,
        feeKey,
      })
      .expect(200);

    // Create MoneyTransaction and match line to it
    const mt = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '100',
          currency: 'RUB',
          description: 'Manual wallet OUT (fee)',
          cashflowCategoryId: feeCashflowCategory.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `mp-fee-a:${lineId}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mt.id })
      .expect(200);

    // Post
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Assert: linked to existing entry, and no STATEMENT_LINE_FEE entry created
    const feeLinks = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mt.id,
        role: CashAccountingLinkRole.FEE,
      } as any,
    });
    expect(feeLinks.some((l) => l.accountingEntryId === existingEntry.id)).toBe(
      true,
    );

    const createdFeeEntries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
    });
    expect(createdFeeEntries.length).toBe(0);
  });

  it('Scenario B: fee not in ledger -> creates STATEMENT_LINE_FEE entry + link (idempotent)', async () => {
    const occurredAt = new Date().toISOString();
    const orderId = `ORD-B-${Date.now()}`;
    const feeCode = 'PENALTY';

    // Import statement line on wallet (OUT)
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `mp-fee-b-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '50',
            currency: 'RUB',
            description: 'Penalty удержание',
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lineId = st.body.lines[0].id as string;

    // Classify line as fee + provide cashflowCategoryId (required when creating new entry)
    await request()
      .patch(`/api/finance/statement-lines/${lineId}/classify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationTypeHint: 'PENALTY',
        externalOperationCode: feeCode,
        marketplaceOrderId: orderId,
        cashflowCategoryId: feeCashflowCategory.id,
      })
      .expect(200);

    // Create MoneyTransaction and match line to it
    const mt = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '50',
          currency: 'RUB',
          description: 'Manual wallet OUT (penalty)',
          cashflowCategoryId: feeCashflowCategory.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `mp-fee-b:${lineId}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mt.id })
      .expect(200);

    // Post (1)
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const createdFeeEntries1 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
    });
    expect(createdFeeEntries1.length).toBe(1);

    const feeLinks1 = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mt.id,
        role: CashAccountingLinkRole.FEE,
      } as any,
    });
    expect(feeLinks1.length).toBeGreaterThan(0);

    // Post (2) idempotent
    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const createdFeeEntries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
    });
    expect(createdFeeEntries2.length).toBe(1);
  });
});
