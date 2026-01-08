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

describe('TZ 8.4.3.2 — Production completion PostingRun + void (e2e)', () => {
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
      name: 'Z-ProdComp',
      code: `ZPCC-${ts}`,
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PCC-${ts}`,
      name: `LE ProdComp ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-PCC-${ts}`,
      name: `Brand ProdComp ${ts}`,
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
      code: `WH-PCC-${ts}`,
      name: 'WH ProdComp',
      type: 'OWN',
      countryId: country.id,
    });

    material = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-PCC-${ts}`,
      name: 'Material PCC',
      unit: 'pcs',
    });
    finishedGood = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `FG-PCC-${ts}`,
      name: 'FG PCC',
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  async function seedStockAndCreateProduct(materialQty: number) {
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
          externalRef: `OFFER-PCC-${ts}`,
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
          quantityOrdered: materialQty,
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
            quantity: materialQty,
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
          internalName: `Product PCC ${ts}`,
          sku: `SKU-PCC-${ts}`,
          brandId: brand.id,
          itemId: finishedGood.id,
        })
        .expect(201)
    ).body;

    return { product };
  }

  async function createOrderStartComplete(
    materialQty: number,
  ): Promise<{ orderId: string; product: any }> {
    const { product } = await seedStockAndCreateProduct(materialQty);
    const orderRes = (
      await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.id,
          quantityPlanned: materialQty,
          unit: 'pcs',
          status: ProductionOrderStatus.DRAFT,
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          producedItemId: product.id,
          producedQty: materialQty,
        })
        .expect(201)
    ).body;
    const orderId = orderRes.order?.id ?? orderRes.id;
    if (!orderId) throw new Error('Expected order id');

    const comp = (
      await request()
        .post(`/api/scm/production-orders/${orderId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          itemId: material.id,
          quantityPlanned: materialQty,
          quantityUnit: 'pcs',
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/scm/production-orders/${orderId}/items/${comp.id}/provision`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: materialQty,
        sourceType: 'INVENTORY',
        note: 'Provision',
      })
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${orderId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return { orderId, product };
  }

  it('completion entry has postingRunId; void creates reversal; repeated void is idempotent', async () => {
    const { orderId } = await createOrderStartComplete(2);

    const entry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
      } as any,
    });
    expect(entry?.postingRunId).toBeTruthy();

    const void1 = await request()
      .post(`/api/scm/production-orders/${orderId}/void-completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(void1.body.reversalRunId).toBeTruthy();

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: void1.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(1);

    await request()
      .post(`/api/scm/production-orders/${orderId}/void-completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);

    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        docType: AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
      } as any,
    });
    expect(runs.length).toBe(2);
  }, 120_000);

  it('negative: cannot void completion if produced FG already moved out (downstream consumption)', async () => {
    const { orderId, product } = await createOrderStartComplete(1);

    const producedBatch = await prisma.stockBatch.findFirst({
      where: { sourceType: 'PRODUCTION' as any, sourceDocId: orderId } as any,
      orderBy: { createdAt: 'asc' } as any,
    });
    expect(producedBatch?.itemId).toBeTruthy();

    // Downstream movement: create a second production order that consumes the produced FG item.
    const order2Res = (
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
    const order2Id = order2Res.order?.id ?? order2Res.id;
    if (!order2Id) throw new Error('Expected order2 id');

    const comp2 = (
      await request()
        .post(`/api/scm/production-orders/${order2Id}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          itemId: producedBatch!.itemId,
          quantityPlanned: 1,
          quantityUnit: 'pcs',
        })
        .expect(201)
    ).body;

    await request()
      .post(
        `/api/scm/production-orders/${order2Id}/items/${comp2.id}/provision`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: 1,
        sourceType: 'INVENTORY',
        note: 'Provision FG as component',
        // scmStock table may not reflect produced FG; allow provisioning to proceed and let FIFO validate on consume.
        allowNegativeStock: true,
      })
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${order2Id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${orderId}/void-completion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'should fail' })
      .expect(409);
  }, 120_000);
});
