import { INestApplication } from '@nestjs/common';
import { AccountingDocType, CounterpartyRole, PrismaClient } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedWarehouse,
} from './api-seed';
import { ACCOUNTING_ACCOUNTS } from '../src/modules/finance/accounting-accounts.config';

describe('TZ 10.1 — Sales return with restock (Return IN + revenue/COGS reversal + links) (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
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
      name: 'TZ10.1-Country',
      code: `TZ101-${ts}`,
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-TZ101-${ts}`,
      name: `LE TZ10.1 ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-TZ101-${ts}`,
      name: `Brand TZ10.1 ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });
    warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-TZ101-${ts}`,
      name: 'WH TZ10.1',
      type: 'OWN',
      countryId: country.id,
    });
    item = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `ITEM-TZ101-${ts}`,
      name: 'Item TZ10.1',
      unit: 'pcs',
    });

    // Seed posting accounts mapping for SalesDocument + SaleReturn posting
    await prisma.financeAccountMapping.upsert({
      where: {
        legalEntityId_docType_marketplaceId: {
          legalEntityId: legalEntity.id,
          docType: AccountingDocType.SALES_DOCUMENT,
          marketplaceId: null,
        },
      } as any,
      update: {
        mapping: {
          arAccount: ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE,
          revenueAccount: ACCOUNTING_ACCOUNTS.SALES_REVENUE,
          contraRevenueAccount: ACCOUNTING_ACCOUNTS.SALES_REVENUE,
          cogsAccount: ACCOUNTING_ACCOUNTS.COGS,
          inventoryAssetAccount: ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS,
          inventoryCogsClearingAccount: ACCOUNTING_ACCOUNTS.CLEARING_INVENTORY_COGS,
          marketplaceFeeExpenseAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
        } as any,
        updatedAt: new Date(),
      } as any,
      create: {
        legalEntityId: legalEntity.id,
        docType: AccountingDocType.SALES_DOCUMENT,
        marketplaceId: null,
        mapping: {
          arAccount: ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE,
          revenueAccount: ACCOUNTING_ACCOUNTS.SALES_REVENUE,
          contraRevenueAccount: ACCOUNTING_ACCOUNTS.SALES_REVENUE,
          cogsAccount: ACCOUNTING_ACCOUNTS.COGS,
          inventoryAssetAccount: ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS,
          inventoryCogsClearingAccount: ACCOUNTING_ACCOUNTS.CLEARING_INVENTORY_COGS,
          marketplaceFeeExpenseAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
        } as any,
      } as any,
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  async function receiveStock(params: { qty: number; unitCost: number }) {
    const ts = Date.now();
    const supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Supplier TZ10.1 ${ts}`, roles: [CounterpartyRole.SUPPLIER] })
        .expect(201)
    ).body;

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
          price: params.unitCost,
          externalRef: `OFFER-TZ101-${ts}`,
        })
        .expect(201)
    ).body;

    const supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `tz101-supply:${ts}`)
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
          quantityOrdered: params.qty,
          unit: 'pcs',
          pricePerUnit: params.unitCost,
          currency: 'RUB',
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/scm/supplies/${supply.id}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            supplyItemId: supplyItem.id,
            quantity: params.qty,
            pricePerUnit: params.unitCost,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);
  }

  it('return restock is idempotent and reverses revenue + COGS while restocking inventory', async () => {
    await receiveStock({ qty: 2, unitCost: 100 });

    const ts = Date.now();
    const sale = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: null,
          warehouseId: warehouse.id,
          sourceType: 'E2E',
          externalId: `SALE-TZ101-${ts}`,
          periodFrom: new Date().toISOString(),
          periodTo: new Date().toISOString(),
          lines: [
            {
              itemId: item.id,
              warehouseId: warehouse.id,
              date: new Date().toISOString(),
              quantity: '2',
              revenue: '600',
              commission: '0',
              refunds: '0',
              meta: {},
            },
          ],
        })
        .expect(201)
    ).body;

    const saleId = sale.id ?? sale?.SalesDocument?.id;
    expect(saleId).toBeTruthy();

    await request()
      .patch(`/api/finance/sales-documents/${saleId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Sale line id (for return request)
    const saleLine = await prisma.salesDocumentLine.findFirst({
      where: { salesDocumentId: saleId },
      select: { id: true },
    });
    expect(saleLine?.id).toBeTruthy();

    const balAfterSale = await prisma.inventoryBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: item.id } } as any,
      select: { quantity: true },
    });
    expect(Number(balAfterSale?.quantity ?? 0)).toBe(0);

    const idem = `tz101-return:${ts}`;
    const ret1 = (
      await request()
        .post(`/api/finance/sales-documents/${saleId}/return`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idem)
        .send({
          occurredAt: new Date().toISOString(),
          lines: [
            {
              saleLineId: saleLine!.id,
              quantity: '1',
              refundAmountBase: '300',
              warehouseId: warehouse.id,
            },
          ],
        })
        .expect(201)
    ).body;

    const returnOpId = ret1?.id ?? ret1?.SalesReturnOperation?.id;
    expect(returnOpId).toBeTruthy();

    // Idempotent retry (same key)
    const ret2 = (
      await request()
        .post(`/api/finance/sales-documents/${saleId}/return`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idem)
        .send({
          occurredAt: new Date().toISOString(),
          lines: [
            {
              saleLineId: saleLine!.id,
              quantity: '1',
              refundAmountBase: '300',
              warehouseId: warehouse.id,
            },
          ],
        })
        .expect(201)
    ).body;
    const returnOpId2 = ret2?.id ?? ret2?.SalesReturnOperation?.id;
    expect(returnOpId2).toBe(returnOpId);

    // Inventory restocked by +1
    const balAfterReturn = await prisma.inventoryBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: item.id } } as any,
      select: { quantity: true },
    });
    expect(Number(balAfterReturn?.quantity ?? 0)).toBe(1);

    const returnMovements = await prisma.stockMovement.findMany({
      where: { docType: 'SALE_RETURN', docId: returnOpId } as any,
      select: { id: true, quantity: true } as any,
    });
    expect(returnMovements.length).toBeGreaterThanOrEqual(1);
    const totalIn = returnMovements.reduce((s, m: any) => s + Number(m.quantity ?? 0), 0);
    expect(totalIn).toBe(1);

    const entries = await prisma.accountingEntry.findMany({
      where: { docType: AccountingDocType.SALE_RETURN, docId: returnOpId } as any,
      orderBy: { lineNumber: 'asc' } as any,
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const revenueReversal = entries.find(
      (e: any) =>
        e.debitAccount === ACCOUNTING_ACCOUNTS.SALES_REVENUE &&
        e.creditAccount === ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE,
    );
    const inventoryEntry = entries.find(
      (e: any) =>
        e.debitAccount === ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS &&
        e.creditAccount === ACCOUNTING_ACCOUNTS.CLEARING_INVENTORY_COGS,
    );
    const cogsEntry = entries.find(
      (e: any) =>
        e.debitAccount === ACCOUNTING_ACCOUNTS.CLEARING_INVENTORY_COGS &&
        e.creditAccount === ACCOUNTING_ACCOUNTS.COGS,
    );
    expect(revenueReversal).toBeTruthy();
    expect(inventoryEntry).toBeTruthy();
    expect(cogsEntry).toBeTruthy();
    expect(new prisma.Prisma.Decimal((revenueReversal as any).amountBase).toString()).toBe('300');
    expect(new prisma.Prisma.Decimal((inventoryEntry as any).amountBase).toString()).toBe('100');
    expect(new prisma.Prisma.Decimal((cogsEntry as any).amountBase).toString()).toBe('100');

    // Links invariants:
    const runId = (inventoryEntry as any).postingRunId ?? (cogsEntry as any).postingRunId;
    expect(runId).toBeTruthy();
    const links = await prisma.inventoryAccountingLink.findMany({
      where: { postingRunId: runId } as any,
      select: { amountBase: true, linkType: true, accountingEntryId: true } as any,
    });
    expect(links.length).toBe(2 * returnMovements.length);

    const sum = (arr: any[]) =>
      arr.reduce((s, x) => s + Number(x.amountBase ?? 0), 0);
    const invLinks = (links as any[]).filter(
      (l) => String(l.linkType) === 'INVENTORY' && String(l.accountingEntryId) === String((inventoryEntry as any).id),
    );
    const cogsLinks = (links as any[]).filter(
      (l) => String(l.linkType) === 'COGS' && String(l.accountingEntryId) === String((cogsEntry as any).id),
    );
    expect(sum(invLinks)).toBe(Number((inventoryEntry as any).amountBase));
    expect(sum(cogsLinks)).toBe(Number((cogsEntry as any).amountBase));
    // In most cases the entry ids must differ.
    expect(String(invLinks[0]?.accountingEntryId)).not.toBe(String(cogsLinks[0]?.accountingEntryId));

    // P&L reflects reversal: revenue 600 -> 300, cogs 200 -> 100
    const day = new Date().toISOString().slice(0, 10);
    const pnl = await request()
      .get('/api/finance/pnl')
      .set('Authorization', `Bearer ${token}`)
      .query({
        brandId: brand.id,
        countryId: country.id,
        dateFrom: day,
        dateTo: day,
      })
      .expect(200);
    expect(pnl.body.totalRevenue).toBe(300);
    expect(pnl.body.totalCogs).toBe(100);
  }, 220_000);
});


