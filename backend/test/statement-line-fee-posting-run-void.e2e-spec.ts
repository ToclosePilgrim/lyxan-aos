import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PrismaClient,
  StatementLineStatus,
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

describe('TZ 8.4.3.3 — StatementLine fee PostingRun + void/repost/unlink (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
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
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      code: `ZSLF${ts}`,
      name: 'Z-StatementFee',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SLF-${ts}`,
      name: `LE StatementFee ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-SLF-${ts}`,
      name: `Brand StatementFee ${ts}`,
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
          name: 'Ozon wallet (fee posting run)',
          provider: 'Ozon',
          externalRef: `wallet-fee-pr-${Date.now()}`,
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
      name: `Item SLF ${ts}`,
      code: `ITEM-SLF-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('Scenario 1 (FEE_ENTRY_CREATED): post creates run+entry; void creates reversal; repeated void is idempotent', async () => {
    const occurredAt = new Date().toISOString();
    const feeCode = 'PENALTY';

    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `slf-fee-created-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
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

    // classify as fee, provide cashflowCategoryId for creation path
    await request()
      .patch(`/api/finance/statement-lines/${lineId}/classify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationTypeHint: 'FEE',
        externalOperationCode: feeCode,
        cashflowCategoryId: feeCashflowCategory.id,
      })
      .expect(200);

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
          idempotencyKey: `slf-fee-created:${lineId}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mt.id })
      .expect(200);

    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const feeEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
      orderBy: { createdAt: 'desc' },
    });
    expect(feeEntry?.postingRunId).toBeTruthy();

    const run = await (prisma as any).accountingPostingRun.findFirst({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
        version: 1,
      } as any,
    });
    expect(run?.id).toBeTruthy();

    const void1 = await request()
      .post(`/api/finance/statement-lines/${lineId}/void-fee-posting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void fee posting' })
      .expect(200);
    expect(void1.body.reversalRunId).toBeTruthy();

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: void1.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(1);

    // idempotent void
    await request()
      .post(`/api/finance/statement-lines/${lineId}/void-fee-posting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void fee posting' })
      .expect(200);

    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
      orderBy: [{ version: 'asc' }],
    });
    expect(runs.length).toBe(2);
  }, 120_000);

  it('Scenario 2 (FEE_LINK_ONLY): post only links to existing fee entry; void-fee-posting unlinks and returns line to MATCHED', async () => {
    const occurredAt = new Date().toISOString();
    const orderId = `ORD-SLF-${Date.now()}`;
    const feeCode = 'COMMISSION';

    // Create SalesDocument -> post -> existing fee entry with marketplace.feeKey
    const sd = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: marketplace.id,
          sourceType: 'E2E',
          externalId: `sd-slf:${orderId}`,
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
    await request()
      .patch(`/api/finance/sales-documents/${sd.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const existingEntry = await prisma.accountingEntry.findFirst({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: sd.id } as any,
      orderBy: { createdAt: 'asc' },
    });
    expect(existingEntry?.id).toBeTruthy();
    const feeKey = (existingEntry as any)?.metadata?.marketplace
      ?.feeKey as string;
    expect(typeof feeKey).toBe('string');

    // Import fee line
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `slf-fee-link-${Date.now()}`,
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
          description: 'Manual wallet OUT (fee link-only)',
          cashflowCategoryId: feeCashflowCategory.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `slf-fee-link:${lineId}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${lineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mt.id })
      .expect(200);

    await request()
      .post(`/api/finance/statement-lines/${lineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const createdFeeEntries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: lineId,
      } as any,
    });
    expect(createdFeeEntries.length).toBe(0);

    const feeLinks = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mt.id,
        role: CashAccountingLinkRole.FEE,
      } as any,
    });
    expect(
      feeLinks.some((l) => l.accountingEntryId === existingEntry!.id),
    ).toBe(true);

    await request()
      .post(`/api/finance/statement-lines/${lineId}/void-fee-posting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'unlink fee' })
      .expect(200);

    const feeLinksAfter = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mt.id,
        role: CashAccountingLinkRole.FEE,
      } as any,
    });
    expect(feeLinksAfter.length).toBe(0);

    const lineAfter = await request()
      .get(`/api/finance/statement-lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(lineAfter.body.status).toBe(StatementLineStatus.MATCHED);
    expect(lineAfter.body.postedAt).toBeNull();
    expect(lineAfter.body.postedMoneyTransactionId).toBeNull();
  }, 120_000);
});





