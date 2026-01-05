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

describe('TZ 8.2 Flow C — Marketplace payout + fee anti-double-count (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let walletAcc: any;
  let bankAcc: any;
  let cfTransfer: any;
  let cfFee: any;
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
      code: 'ZFC',
      name: 'Z-Flow-C',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-FC-${ts}`,
      name: `LE Flow C ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-FC-${ts}`,
      name: `Brand Flow C ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    // Ensure transfer category exists and is marked isTransfer (for includeTransfers=false)
    cfTransfer = await seedCashflowCategory({
      request,
      token,
      code: 'CF_TRANSFER_INTERNAL',
      name: 'Internal transfers',
      isTransfer: true,
    });
    cfFee = await seedCashflowCategory({
      request,
      token,
      code: `CF_MP_FEE_${ts}`,
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
          name: 'Wallet',
          provider: 'Ozon',
          externalRef: `wallet-${Date.now()}`,
        })
        .expect(201)
    ).body;
    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank',
          provider: 'Sber',
          externalRef: `bank-${Date.now()}`,
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
      name: `Item ${ts}`,
      code: `ITEM-FC-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('payout transfer + fee posting without double-count; cashflow reconciliation holds', async () => {
    const ref = `PAYOUT-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    // Import wallet OUT and bank IN statement lines
    const impWallet = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `fc-w-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout',
            bankReference: ref,
            externalLineId: ref,
          },
        ],
      })
      .expect(200);
    const stWallet = await request()
      .get(`/api/finance/statements/${impWallet.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const walletLineId = stWallet.body.lines[0].id as string;

    const impBank = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `fc-b-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.IN,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout in',
            bankReference: ref,
          },
        ],
      })
      .expect(200);
    const stBank = await request()
      .get(`/api/finance/statements/${impBank.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const bankLineId = stBank.body.lines[0].id as string;

    // Create moneyTx for both legs via public API, then match and post statement lines
    const mtWallet = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '1000',
          currency: 'RUB',
          description: 'Wallet payout out',
          cashflowCategoryId: cfTransfer.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `fc-wallet:${ref}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtWallet.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const mtBank = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: bankAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.IN,
          amount: '1000',
          currency: 'RUB',
          description: 'Bank payout in',
          cashflowCategoryId: cfTransfer.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `fc-bank:${ref}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtBank.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Pair + post transfer
    const pairRes = await request()
      .post('/api/finance/cash-transfers/marketplace/pair')
      .set('Authorization', `Bearer ${token}`)
      .send({
        walletStatementLineId: walletLineId,
        bankStatementLineId: bankLineId,
        provider: 'Ozon',
        externalRef: ref,
      })
      .expect(200);
    const transferId = pairRes.body.transferId as string;
    await request()
      .post(`/api/finance/cash-transfers/${transferId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transferEntries = await prisma.accountingEntry.findMany({
      where: {
        docType: 'MARKETPLACE_PAYOUT_TRANSFER' as any,
        docId: transferId,
      } as any,
    });
    expect(transferEntries.length).toBe(2);
    const transferLinks = await prisma.cashAccountingLink.findMany({
      where: {
        role: CashAccountingLinkRole.TRANSFER,
        moneyTransactionId: { in: [mtWallet.id, mtBank.id] },
      } as any,
    });
    expect(transferLinks.length).toBe(2);

    // Fee anti-double-count: create SalesDocument in DB (no public create endpoint), post via API
    const orderId = `ORD-${Date.now()}`;
    const feeCode = 'COMMISSION';
    const sd = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: marketplace.id,
          sourceType: 'E2E',
          externalId: `flow-c:${orderId}`,
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

    const existingFeeEntry = await prisma.accountingEntry.findFirst({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: sd.id } as any,
      orderBy: { createdAt: 'asc' } as any,
    });
    expect(existingFeeEntry?.id).toBeDefined();
    const feeKey = (existingFeeEntry as any).metadata?.marketplace
      ?.feeKey as string;
    expect(typeof feeKey).toBe('string');

    // Import fee statement line
    const impFee = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `fc-fee-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
            currency: 'RUB',
            description: 'Fee удержание',
          },
        ],
      })
      .expect(200);
    const stFee = await request()
      .get(`/api/finance/statements/${impFee.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const feeLineId = stFee.body.lines[0].id as string;

    await request()
      .patch(`/api/finance/statement-lines/${feeLineId}/classify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationTypeHint: 'FEE',
        externalOperationCode: feeCode,
        marketplaceOrderId: orderId,
        saleDocumentId: sd.id,
        feeKey,
      })
      .expect(200);

    const mtFee = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '100',
          currency: 'RUB',
          description: 'Wallet fee out',
          cashflowCategoryId: cfFee.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `fc-fee:${feeLineId}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${feeLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtFee.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${feeLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const feeLinks = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mtFee.id,
        role: CashAccountingLinkRole.FEE,
      } as any,
    });
    expect(
      feeLinks.some((l) => l.accountingEntryId === existingFeeEntry!.id),
    ).toBe(true);
    const createdFeeEntries = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        legalEntityId: legalEntity.id,
      } as any,
    });
    expect(createdFeeEntries).toBe(0);

    // cashflow report: transfers excluded from byCategory when includeTransfers=false, reconciliation holds
    const from = occurredAt.slice(0, 10);
    const to = occurredAt.slice(0, 10);
    const cfRes = await request()
      .get(
        `/api/finance/reports/cashflow?legalEntityId=${legalEntity.id}&from=${from}&to=${to}&groupBy=category&includeTransfers=false`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cfRes.body.reconciliation.isReconciled).toBe(true);
    const byIds = new Set(
      cfRes.body.byCategory.map((x: any) => x.cashflowCategoryId),
    );
    expect(byIds.has(cfTransfer.id)).toBe(false);

    // explain cashflow for fee category should include StatementLine + SalesDocument
    const exp = await request()
      .get(
        `/api/finance/reports/explain/cashflow?legalEntityId=${legalEntity.id}&from=${occurredAt}&to=${occurredAt}&cashflowCategoryId=${cfFee.id}&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const primaryTypes = new Set(
      exp.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('StatementLine')).toBe(true);
    expect(primaryTypes.has('SalesDocument')).toBe(true);
  });
});
