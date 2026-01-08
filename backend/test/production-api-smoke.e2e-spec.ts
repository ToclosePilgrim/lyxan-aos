import crypto from 'node:crypto';
import {
  AccountingDocType,
  CounterpartyRole,
  PrismaClient,
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

describe('TZ 8.3.B.2 — Production API smoke (e2e)', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('create → add component → start (auto-consume) → complete; creates entries + links', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const ts = Date.now();

    const country = await seedCountry({
      request,
      token,
      name: 'Testland',
      code: `TL-${ts}`,
    });
    const legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-${ts}`,
      name: 'E2E LE',
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token,
      code: `BR-${ts}`,
      name: 'E2E Brand',
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });
    const warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-${ts}`,
      name: 'E2E Warehouse',
      countryId: country.id,
      type: 'OWN',
    });

    const material = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-${ts}`,
      name: 'Material',
      unit: 'pcs',
    });
    const finishedGood = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      code: `FG-${ts}`,
      name: 'Finished Good',
      unit: 'pcs',
    });

    // Seed stock via SCM supply receive (SCM API)
    const supplierCp = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Supplier CP', roles: [CounterpartyRole.SUPPLIER] })
        .expect(201)
    ).body;

    const offer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: supplierCp.id,
          mdmItemId: material.id,
          offerType: 'MATERIAL',
          currency: 'RUB',
          price: 10,
          externalRef: `OFFER-${Date.now()}`,
        })
        .expect(201)
    ).body;

    const supply = (
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

    // Create SCM product (API) and production order (API)
    const product = (
      await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalName: 'Test Product',
          sku: `SKU-${Date.now()}`,
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
          quantityPlanned: 10,
          unit: 'pcs',
          status: 'DRAFT',
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          producedItemId: product.id,
          producedQty: 10,
        })
        .expect(201)
    ).body;
    const orderId = orderRes.order?.id ?? orderRes.id;
    if (!orderId) throw new Error('Expected production order id');

    // Add component (API)
    const comp = (
      await request()
        .post(`/api/scm/production-orders/${orderId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: material.id, quantityPlanned: 10, quantityUnit: 'pcs' })
        .expect(201)
    ).body;

    // Provision component (MVP requirement: cannot start without provisioning)
    await request()
      .post(`/api/scm/production-orders/${orderId}/items/${comp.id}/provision`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        amount: 10,
        sourceType: 'INVENTORY',
        note: 'Provision via API',
      })
      .expect(200);

    // Start production -> auto-consume remaining (creates PRODUCTION_CONSUMPTION entry + links)
    await request()
      .post(`/api/scm/production-orders/${orderId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Complete -> creates PRODUCTION_COMPLETION entry
    await request()
      .post(`/api/scm/production-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const consumptionEntry = await prisma.accountingEntry.findFirst({
      where: { docType: AccountingDocType.PRODUCTION_CONSUMPTION } as any,
      orderBy: { createdAt: 'desc' },
    });
    expect(consumptionEntry?.debitAccount).toBe('20.01');
    expect(consumptionEntry?.creditAccount).toBe('10.01');

    const completionEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
      } as any,
    });
    expect(completionEntry?.debitAccount).toBe('10.02');
    expect(completionEntry?.creditAccount).toBe('20.01');

    if (app) await app.close();
  }, 120_000);
});
