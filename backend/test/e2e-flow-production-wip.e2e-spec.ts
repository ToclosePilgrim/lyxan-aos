import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
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

describe('TZ 8.2 Flow B — Production: consumption → WIP → completion (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
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
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    country = await seedCountry({
      request,
      token,
      code: 'ZFB',
      name: 'Z-Flow-B',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-FB-${Date.now()}`,
      name: `LE Flow B ${Date.now()}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-FB-${Date.now()}`,
      name: `Brand Flow B ${Date.now()}`,
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
      code: `WH-FB-${Date.now()}`,
      name: `WH Flow B ${Date.now()}`,
      type: 'OWN',
      countryId: country.id,
    });

    // Seed stock via SCM supply receiving (public APIs)
    supplierCp = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier FB ${Date.now()}`,
          code: `SUP-FB-${Date.now()}`,
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
          itemType: 'MATERIAL',
          itemName: `Material FB ${Date.now()}`,
          itemSku: `MAT-FB-${Date.now()}`,
          offerType: 'MATERIAL',
          sku: `VSKU-FB-${Date.now()}`,
          currency: 'RUB',
          price: 5,
          externalRef: `FB-OFFER-${Date.now()}`,
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

    // Create SCM product via public API
    product = (
      await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalName: `Product FB ${Date.now()}`,
          sku: `SKU-FB-${Date.now()}`,
          brandId: brand.id,
        })
        .expect(201)
    ).body;

    // Create production order (DRAFT to allow editing), add component via API
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
    if (!order?.id) throw new Error('Expected production order id');

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

    // Provision via public API (no Prisma hacks)
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('consumption posts WIP and completion moves WIP -> FG; explain shows ProductionOrder', async () => {
    // Start (auto-consume OWN_STOCK components) => posts WIP consumption + inventory tx
    await request()
      .post(`/api/scm/production-orders/${order.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const invTxn = await prisma.inventoryTransaction.findFirst({
      where: { docType: 'PRODUCTION_INPUT', docId: order.id } as any,
      orderBy: { createdAt: 'desc' } as any,
    });
    expect(invTxn?.id).toBeDefined();

    const wipEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: invTxn!.id,
      } as any,
    });
    expect(wipEntry?.debitAccount).toBe('20.01');
    expect(wipEntry?.creditAccount).toBe('10.01');

    const ial = await prisma.inventoryAccountingLink.findFirst({
      where: { accountingEntryId: wipEntry!.id } as any,
    });
    expect(ial?.id).toBeDefined();

    // Complete
    await request()
      .post(`/api/scm/production-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const completionEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PRODUCTION_COMPLETION,
        docId: order.id,
      } as any,
    });
    expect(completionEntry?.debitAccount).toBe('10.02');
    expect(completionEntry?.creditAccount).toBe('20.01');

    // Explain BS for WIP account includes ProductionOrder
    const at = new Date().toISOString().slice(0, 10);
    const exp = await request()
      .get(
        `/api/finance/reports/explain/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}&accountId=20.01&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const primaryTypes = new Set(
      exp.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('ProductionOrder')).toBe(true);

    // Reports smoke
    await request()
      .get(
        `/api/finance/reports/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
