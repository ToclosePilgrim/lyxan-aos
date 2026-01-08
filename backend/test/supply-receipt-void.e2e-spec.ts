import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinanceLinkedDocType,
  FinancialDocumentType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import * as apiSeed from './api-seed';

describe('TZ 8.4.3.1 — SupplyReceipt posting via PostingRun + void (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
  let cashflowCategory: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    country = await apiSeed.seedCountry({
      request,
      token,
      code: `ZSRV-${ts}`,
      name: 'Z-ReceiptVoid',
    });
    legalEntity = await apiSeed.seedLegalEntity({
      request,
      token,
      code: `LE-SRV-${ts}`,
      name: `LE ReceiptVoid ${ts}`,
      countryCode: country.code,
    });
    brand = await apiSeed.seedBrand({
      request,
      token,
      code: `BR-SRV-${ts}`,
      name: `Brand ReceiptVoid ${ts}`,
    });
    await apiSeed.seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });
    warehouse = await apiSeed.seedWarehouse({
      request,
      token,
      code: `WH-SRV-${ts}`,
      name: 'WH ReceiptVoid',
      type: 'OWN',
      countryId: country.id,
    });

    cashflowCategory = await apiSeed.seedCashflowCategory({
      request,
      token,
      code: `CF-SUPINV-${ts}`,
      name: 'Supply invoices',
      isTransfer: false,
    });
    await apiSeed.seedCategoryDefaultMapping({
      request,
      token,
      legalEntityId: legalEntity.id,
      sourceType: 'FINANCIAL_DOCUMENT_TYPE',
      sourceCode: 'SUPPLY_INVOICE',
      defaultCashflowCategoryId: cashflowCategory.id,
      defaultPnlCategoryId: null,
      priority: 1,
      isActive: true,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  async function createSupplyAndReceipt(): Promise<{
    supplyId: string;
    receiptId: string;
  }> {
    const ts = Date.now();
    const supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier ${ts}`,
          code: `SUP-SRV-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    const item = await apiSeed.seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-SRV-${ts}`,
      name: 'Material',
      unit: 'pcs',
    });

    const offer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: supplier.id,
          mdmItemId: item.id,
          offerType: 'MATERIAL',
          currency: 'RUB',
          price: 10,
          externalRef: `OFFER-SRV-${ts}`,
        })
        .expect(201)
    ).body;

    const supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplier.id,
          brandId: brand.id,
          warehouseId: warehouse.id,
          currency: 'RUB',
          status: 'ORDERED',
        })
        .expect(201)
    ).body;

    const supplyItem = (
      await request()
        .post(`/api/scm/supplies/${supply.id}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          offerId: offer.id,
          quantityOrdered: 10,
          unit: 'pcs',
          pricePerUnit: 10,
          currency: 'RUB',
        })
        .expect(201)
    ).body;

    const receive = await request()
      .post(`/api/scm/supplies/${supply.id}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            supplyItemId: supplyItem.id,
            quantity: 10,
            pricePerUnit: 10,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);

    const receiptId = receive.body.receipts?.[0]?.id as string;
    expect(receiptId).toBeTruthy();
    return { supplyId: supply.id, receiptId };
  }

  it('receipt entry has postingRunId; void creates reversal; repeated void is idempotent', async () => {
    const { receiptId } = await createSupplyAndReceipt();

    const entry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(entry?.id).toBeTruthy();
    expect(entry?.postingRunId).toBeTruthy();
    expect(entry?.metadata?.docLineId).toBe(
      `supply_receipt:${receiptId}:total`,
    );

    const voidRes = await request()
      .post(`/api/scm/supply-receipts/${receiptId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(voidRes.body.reversalRunId).toBeTruthy();

    const runs1 = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(runs1.length).toBe(2);

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: voidRes.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(1);
    expect(reversalEntries[0].metadata?.docLineId).toContain(
      `reversal:${entry!.postingRunId}`,
    );

    await request()
      .post(`/api/scm/supply-receipts/${receiptId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);

    const runs2 = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(runs2.length).toBe(2);
  }, 120_000);

  it('negative: cannot void when linked supply invoice is accrued', async () => {
    const { receiptId } = await createSupplyAndReceipt();

    const doc = (
      await request()
        .post('/api/finance/documents/from-supply-receipt')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplyReceiptId: receiptId,
          invoiceNumber: `INV-${Date.now()}`,
          invoiceDate: new Date().toISOString(),
        })
        .expect(201)
    ).body;
    expect(doc.linkedDocType).toBe(FinanceLinkedDocType.SUPPLY_RECEIPT);
    expect(doc.linkedDocId).toBe(receiptId);

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const reloaded = await prisma.financialDocument.findUnique({
      where: { id: doc.id },
    });
    expect(reloaded?.type).toBe(FinancialDocumentType.SUPPLY_INVOICE);
    expect(reloaded?.isAccrued).toBe(true);

    await request()
      .post(`/api/scm/supply-receipts/${receiptId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'should fail' })
      .expect(409);
  }, 120_000);
});
