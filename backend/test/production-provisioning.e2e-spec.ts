import { INestApplication } from '@nestjs/common';
import {
  CounterpartyRole,
  PrismaClient,
  ProductionOrderStatus,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedWarehouse,
} from './api-seed';

describe('TZ 8.3.B.2 — Production provisioning API (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;

  let supplierCp: any;
  let offer: any;
  let supply: any;
  let product: any;
  let order: any;
  let orderItem: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();

    // Infra setup via public APIs (api-seed helpers)
    country = await seedCountry({
      request,
      token,
      code: `ZPV-${ts}`,
      name: 'Z-Provision',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PV-${ts}`,
      name: `LE Provision ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-PV-${ts}`,
      name: `Brand Provision ${ts}`,
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
      code: `WH-PV-${ts}`,
      name: `WH Provision ${ts}`,
      type: 'OWN',
      countryId: country.id,
    });

    // Seed stock via SCM supply receiving (API-only for MDM/SCM entities)
    supplierCp = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier PV ${Date.now()}`,
          code: `SUP-PV-${Date.now()}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    offer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: supplierCp.id,
          // auto-create MDM item for MATERIAL
          itemType: 'MATERIAL',
          itemName: `Material PV ${Date.now()}`,
          itemSku: `MAT-PV-${Date.now()}`,
          offerType: 'MATERIAL',
          currency: 'RUB',
          price: 5,
          externalRef: `PV-OFFER-${Date.now()}`,
        })
        .expect(201)
    ).body;

    supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplierCp.id,
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
          pricePerUnit: 5,
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
            pricePerUnit: 5,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);

    product = (
      await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalName: `Product PV ${Date.now()}`,
          sku: `SKU-PV-${Date.now()}`,
          brandId: brand.id,
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
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          status: ProductionOrderStatus.DRAFT,
        })
        .expect(201)
    ).body;
    order = orderRes.order ?? orderRes;

    orderItem = (
      await request()
        .post(`/api/scm/production-orders/${order.id}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          itemId: offer.mdmItemId,
          quantityPlanned: 1,
          quantityUnit: 'pcs',
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('start without provision -> 409; provision -> 200; start -> 200', async () => {
    await request()
      .post(`/api/scm/production-orders/${order.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    await request()
      .post(
        `/api/scm/production-orders/${order.id}/items/${orderItem.id}/provision`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: 1,
        sourceType: 'INVENTORY',
        note: 'Provision via API',
      })
      .expect(200);

    await request()
      .post(`/api/scm/production-orders/${order.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 120_000);
});
