import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
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

describe('TZ 8.4.3.2 — Production consumption PostingRun + void (e2e)', () => {
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

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      name: 'Z-ProdCons',
      code: `ZPC-${ts}`,
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PC-${ts}`,
      name: `LE ProdCons ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-PC-${ts}`,
      name: `Brand ProdCons ${ts}`,
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
      code: `WH-PC-${ts}`,
      name: 'WH ProdCons',
      type: 'OWN',
      countryId: country.id,
    });

    material = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-PC-${ts}`,
      name: 'Material PC',
      unit: 'pcs',
    });
    finishedGood = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `FG-PC-${ts}`,
      name: 'FG PC',
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function seedStockAndCreateProduct() {
    const ts = Date.now();
    const supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Supplier ${ts}`, roles: [CounterpartyRole.SUPPLIER] })
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
          currency: 'RUB',
          price: 10,
          externalRef: `OFFER-PC-${ts}`,
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

    await request()
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

    const product = (
      await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalName: `Product PC ${ts}`,
          sku: `SKU-PC-${ts}`,
          brandId: brand.id,
          itemId: finishedGood.id,
        })
        .expect(201)
    ).body;

    return { product };
  }

  async function createOrderAndStart(): Promise<{ orderId: string }> {
    const { product } = await seedStockAndCreateProduct();
    const orderRes = (
      await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.id,
          quantityPlanned: 10,
          unit: 'pcs',
          status: ProductionOrderStatus.DRAFT,
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          producedItemId: product.id,
          producedQty: 10,
        })
        .expect(201)
    ).body;
    const orderId = orderRes.order?.id ?? orderRes.id;
    if (!orderId) throw new Error('Expected order id');

    const comp = (
      await request()
        .post(`/api/scm/production-orders/${orderId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: material.id, quantityPlanned: 10, quantityUnit: 'pcs' })
        .expect(201)
    ).body;

    await request()
      .post(`/api/scm/production-orders/${orderId}/items/${comp.id}/provision`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: 10,
        sourceType: 'INVENTORY',
        note: 'Provision',
      })
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${orderId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return { orderId };
  }

  it('post is run-based: entry has postingRunId; void creates reversal; repeated void is idempotent', async () => {
    const { orderId } = await createOrderAndStart();

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
    });
    expect(entry?.postingRunId).toBeTruthy();

    const void1 = await request()
      .post(`/api/scm/production-consumptions/${invTxn!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(void1.body.reversalRunId).toBeTruthy();

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: void1.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(1);

    await request()
      .post(`/api/scm/production-consumptions/${invTxn!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);

    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: invTxn!.id,
      } as any,
    });
    expect(runs.length).toBe(2);
  }, 120_000);

  it('negative: cannot void consumption after completion exists', async () => {
    const { orderId } = await createOrderAndStart();
    await request()
      .post(`/api/scm/production-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const invTxn = await prisma.inventoryTransaction.findFirst({
      where: { docType: 'PRODUCTION_INPUT', docId: orderId } as any,
      orderBy: { createdAt: 'desc' } as any,
    });
    expect(invTxn?.id).toBeTruthy();

    await request()
      .post(`/api/scm/production-consumptions/${invTxn!.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'should fail' })
      .expect(409);
  }, 120_000);
});

