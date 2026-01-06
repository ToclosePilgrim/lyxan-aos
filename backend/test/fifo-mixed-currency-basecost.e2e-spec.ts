import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  Prisma,
  PrismaClient,
  ProductionOrderStatus,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedWarehouse,
} from './api-seed';

function startOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

describe('TZ 8 — FIFO mixed currencies -> totalCostBase in base currency (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
  let material: any;
  let finishedGood: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    // Ensure FX for EUR exists (base is FINANCE_BASE_CURRENCY, default USD)
    const today = startOfDayUtc(new Date());
    await prisma.currencyRate.upsert({
      where: {
        currency_rateDate: { currency: 'EUR', rateDate: today },
      },
      update: { rateToBase: '1.2', source: 'e2e', updatedAt: new Date() } as any,
      create: {
        currency: 'EUR',
        rateDate: today,
        rateToBase: '1.2',
        source: 'e2e',
      } as any,
    });

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      name: 'TZ8-Country',
      code: `TZ8-${ts}`,
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-TZ8-${ts}`,
      name: `LE TZ8 ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-TZ8-${ts}`,
      name: `Brand TZ8 ${ts}`,
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
      code: `WH-TZ8-${ts}`,
      name: 'WH TZ8',
      type: 'OWN',
      countryId: country.id,
    });

    material = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-TZ8-${ts}`,
      name: 'Material TZ8',
      unit: 'pcs',
    });
    finishedGood = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `FG-TZ8-${ts}`,
      name: 'FG TZ8',
      unit: 'pcs',
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function receiveSupply(params: {
    externalRef: string;
    currency: 'USD' | 'EUR';
    qty: number;
    pricePerUnit: number;
  }) {
    const supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Supplier ${params.externalRef}`, roles: [CounterpartyRole.SUPPLIER] })
        .expect(201)
    ).body;

    const offer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: supplier.id,
          mdmItemId: material.id,
          offerType: 'MATERIAL',
          currency: params.currency,
          price: params.pricePerUnit,
          externalRef: params.externalRef,
        })
        .expect(201)
    ).body;

    const supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `tz8-supply:${params.externalRef}`)
        .send({
          supplierCounterpartyId: supplier.id,
          brandId: brand.id,
          warehouseId: warehouse.id,
          currency: params.currency,
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
          pricePerUnit: params.pricePerUnit,
          currency: params.currency,
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
            pricePerUnit: params.pricePerUnit,
            currency: params.currency,
          },
        ],
      })
      .expect(200);
  }

  it('computes totalCostBase across USD+EUR batches and posts AccountingEntry.amountBase in base currency', async () => {
    const ts = Date.now();

    // Create two batches for the same item:
    // batch1: 1 qty, 100 USD, fx=1.0 => unitCostBase 100
    // batch2: 1 qty, 100 EUR, fx=1.2 => unitCostBase 120
    await receiveSupply({ externalRef: `TZ8-USD-${ts}`, currency: 'USD', qty: 1, pricePerUnit: 100 });
    await receiveSupply({ externalRef: `TZ8-EUR-${ts}`, currency: 'EUR', qty: 1, pricePerUnit: 100 });

    const product = (
      await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalName: `Product TZ8 ${ts}`,
          sku: `SKU-TZ8-${ts}`,
          brandId: brand.id,
          itemId: finishedGood.id,
        })
        .expect(201)
    ).body;

    const orderRes = (
      await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.id,
          quantityPlanned: 1,
          unit: 'pcs',
          status: ProductionOrderStatus.DRAFT,
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          producedItemId: product.id,
          producedQty: 1,
        })
        .expect(201)
    ).body;
    const orderId = orderRes.order?.id ?? orderRes.id;
    expect(orderId).toBeTruthy();

    const comp = (
      await request()
        .post(`/api/scm/production-orders/${orderId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: material.id, quantityPlanned: 2, quantityUnit: 'pcs' })
        .expect(201)
    ).body;

    // Provision from inventory: should consume 2 units FIFO (1 from USD batch + 1 from EUR batch)
    await request()
      .post(`/api/scm/production-orders/${orderId}/items/${comp.id}/provision`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: 2,
        sourceType: 'INVENTORY',
        note: 'TZ8 provision',
      })
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${orderId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const invTxn = await prisma.inventoryTransaction.findFirst({
      where: { docType: 'PRODUCTION_INPUT', docId: orderId } as any,
      orderBy: { createdAt: 'desc' } as any,
    });
    expect(invTxn?.id).toBeTruthy();

    const entry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: invTxn!.id,
      } as any,
      orderBy: { lineNumber: 'asc' } as any,
    });
    expect(entry?.id).toBeTruthy();

    const baseCurrency = process.env.FINANCE_BASE_CURRENCY || 'USD';
    expect((entry as any).currency).toBe(baseCurrency);
    expect(new Prisma.Decimal((entry as any).amountBase).toString()).toBe('220');

    const movements = await prisma.stockMovement.findMany({
      where: { inventoryTransactionId: invTxn!.id } as any,
      select: { id: true, batchId: true, meta: true } as any,
      orderBy: { createdAt: 'asc' } as any,
    });
    expect(movements.length).toBeGreaterThanOrEqual(2);

    const sumLineCostBase = movements.reduce((sum, mv: any) => {
      const v = mv.meta?.lineCostBase;
      if (typeof v !== 'string') return sum;
      return sum + Number(v);
    }, 0);
    expect(sumLineCostBase).toBe(220);
  }, 180_000);
});


