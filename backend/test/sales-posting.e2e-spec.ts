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

describe('TZ 10 — Sales posting (Revenue + COGS + InventoryAccountingLink) (e2e)', () => {
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
      name: 'TZ10-Country',
      code: `TZ10-${ts}`,
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-TZ10-${ts}`,
      name: `LE TZ10 ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-TZ10-${ts}`,
      name: `Brand TZ10 ${ts}`,
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
      code: `WH-TZ10-${ts}`,
      name: 'WH TZ10',
      type: 'OWN',
      countryId: country.id,
    });
    item = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `ITEM-TZ10-${ts}`,
      name: 'Item TZ10',
      unit: 'pcs',
    });

    // Seed posting accounts mapping for SalesDocument posting
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
          // MVP: use same revenue account as contra-revenue (debit Revenue)
          contraRevenueAccount: ACCOUNTING_ACCOUNTS.SALES_REVENUE,
          cogsAccount: ACCOUNTING_ACCOUNTS.COGS,
          inventoryAssetAccount: ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS,
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
        .send({ name: `Supplier TZ10 ${ts}`, roles: [CounterpartyRole.SUPPLIER] })
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
          externalRef: `OFFER-TZ10-${ts}`,
        })
        .expect(201)
    ).body;

    const supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `tz10-supply:${ts}`)
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

  it('posts sale: revenue+refunds as contra-revenue, cogs, links, and P&L shows refunds reducing revenue', async () => {
    // IN: 1 batch qty=2 costBase=100 (RUB rate is seeded as 1 in e2e setup)
    await receiveStock({ qty: 2, unitCost: 100 });

    const ts = Date.now();
    const doc = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: null,
          warehouseId: warehouse.id,
          sourceType: 'E2E',
          externalId: `SALE-TZ10-${ts}`,
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
              refunds: '100',
              meta: {},
            },
          ],
        })
        .expect(201)
    ).body;

    const salesDocId = doc.id ?? doc?.SalesDocument?.id;
    expect(salesDocId).toBeTruthy();

    await request()
      .patch(`/api/finance/sales-documents/${salesDocId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updated = await prisma.salesDocument.findUnique({
      where: { id: salesDocId },
      select: { status: true },
    });
    expect(updated?.status).toBe('POSTED');

    const entries = await prisma.accountingEntry.findMany({
      where: { docType: AccountingDocType.SALES_DOCUMENT, docId: salesDocId } as any,
      orderBy: { lineNumber: 'asc' } as any,
    });
    // revenue + refund + cogs (fees are zero here)
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const revenueEntry = entries.find((e: any) => e.creditAccount === '90.01');
    const refundEntry = entries.find(
      (e: any) =>
        e.debitAccount === ACCOUNTING_ACCOUNTS.SALES_REVENUE &&
        e.creditAccount === ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE,
    );
    const cogsEntry = entries.find((e: any) => e.debitAccount === '90.02');
    expect(revenueEntry).toBeTruthy();
    expect(refundEntry).toBeTruthy();
    expect(cogsEntry).toBeTruthy();

    expect(new prisma.Prisma.Decimal((revenueEntry as any).amountBase).toString()).toBe('600');
    expect(new prisma.Prisma.Decimal((refundEntry as any).amountBase).toString()).toBe('100');
    expect(new prisma.Prisma.Decimal((cogsEntry as any).amountBase).toString()).toBe('200');

    const movements = await prisma.stockMovement.findMany({
      where: { docType: 'SALE', docId: salesDocId } as any,
      select: { id: true, quantity: true, meta: true } as any,
    });
    expect(movements.length).toBeGreaterThanOrEqual(1);
    const totalOut = movements.reduce((sum, m: any) => sum + Math.abs(Number(m.quantity)), 0);
    expect(totalOut).toBe(2);

    const links = await prisma.inventoryAccountingLink.findMany({
      where: { accountingEntryId: (cogsEntry as any).id } as any,
      select: { stockMovementId: true, amountBase: true, linkType: true } as any,
    });
    expect(links.length).toBe(2 * movements.length);

    const byType = new Map<string, number>();
    for (const l of links as any[]) {
      const key = String(l.linkType ?? 'null');
      byType.set(key, (byType.get(key) ?? 0) + Number(l.amountBase ?? 0));
    }
    const cogsAmountBase = Number((cogsEntry as any).amountBase);
    const inventoryAmountBase = Number((cogsEntry as any).amountBase);
    expect(byType.get('COGS')).toBe(cogsAmountBase);
    expect(byType.get('INVENTORY')).toBe(inventoryAmountBase);

    // P&L via API: revenue should be reduced by refunds, and COGS should stay positive expense.
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
    expect(pnl.body.totalRevenue).toBe(500);
    expect(pnl.body.totalCogs).toBe(200);
  }, 180_000);
});


