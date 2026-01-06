import { INestApplication } from '@nestjs/common';
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
import { InventoryDocumentType } from '../src/modules/inventory/inventory.enums';

describe('TZ 4 — Inventory Events Multi-Movement OUT (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
  let supplier: any;
  let item: any;
  let offer: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    // Seed test data
    country = await seedCountry(prisma, request(), token);
    legalEntity = await seedLegalEntity(prisma, request(), token, country.id);
    brand = await seedBrand(prisma, request(), token);
    await seedBrandCountry(prisma, request(), token, brand.id, country.id);
    warehouse = await seedWarehouse(prisma, request(), token, country.id);

    supplier = await request()
      .post('/api/mdm/counterparties')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Supplier', roles: [CounterpartyRole.SUPPLIER] })
      .expect(201);

    item = await seedMdmItem(
      prisma,
      request(),
      token,
      'MATERIAL',
      'Test Item Multi-Out',
    );

    offer = await request()
      .post('/api/mdm/counterparty-offers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        counterpartyId: supplier.body.id,
        mdmItemId: item.id,
        offerType: 'MATERIAL',
        currency: 'RUB',
        price: 10,
        externalRef: `OFFER-${Date.now()}`,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should emit multiple STOCK_CHANGED events for multi-batch OUT outcome', async () => {
    // Step 1: Create 2 supply receipts with different prices to create 2 batches
    const supply1Id = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplier.body.id,
          warehouseId: warehouse.id,
          currency: 'RUB',
          brandId: brand.id,
        })
        .expect(201)
    ).body.id;

    const supplyItem1 = await request()
      .post(`/api/scm/supplies/${supply1Id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        offerId: offer.body.id,
        quantityOrdered: 5,
        unit: 'pcs',
        pricePerUnit: 10, // First batch at price 10
        currency: 'RUB',
      })
      .expect(201);

    await request()
      .post(`/api/scm/supplies/${supply1Id}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            supplyItemId: supplyItem1.body.id,
            quantity: 5,
            pricePerUnit: 10,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);

    // Second supply with different price
    const supply2Id = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplier.body.id,
          warehouseId: warehouse.id,
          currency: 'RUB',
          brandId: brand.id,
        })
        .expect(201)
    ).body.id;

    const supplyItem2 = await request()
      .post(`/api/scm/supplies/${supply2Id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        offerId: offer.body.id,
        quantityOrdered: 5,
        unit: 'pcs',
        pricePerUnit: 15, // Second batch at price 15
        currency: 'RUB',
      })
      .expect(201);

    await request()
      .post(`/api/scm/supplies/${supply2Id}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            supplyItemId: supplyItem2.body.id,
            quantity: 5,
            pricePerUnit: 15,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);

    // Verify we have 2 batches
    const batches = await prisma.stockBatch.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
      } as any,
      orderBy: { createdAt: 'asc' },
    });
    expect(batches.length).toBeGreaterThanOrEqual(2);

    // Step 2: Create a production order and consume more than batch1 quantity
    // This will trigger FIFO OUT from multiple batches
    const product = await request()
      .post('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalName: `Product Multi-Out ${Date.now()}`,
        sku: `SKU-MO-${Date.now()}`,
        brandId: brand.id,
      })
      .expect(201);

    const order = (
      await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.body.id,
          quantityPlanned: 1,
          unit: 'pcs',
          outputWarehouseId: warehouse.id,
          warehouseId: warehouse.id,
          status: 'DRAFT',
        })
        .expect(201)
    ).body.order ?? product.body;

    const orderItem = await request()
      .post(`/api/scm/production-orders/${order.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: item.id,
        quantityRequired: 7, // More than first batch (5), will consume from 2 batches
        unit: 'pcs',
      })
      .expect(201);

    // Start production order (triggers consumption)
    await request()
      .post(`/api/scm/production-orders/${order.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Step 3: Verify multiple movements were created
    const movements = await prisma.stockMovement.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
        docType: InventoryDocumentType.PRODUCTION_INPUT,
        docId: order.id,
      } as any,
      orderBy: { createdAt: 'asc' },
    });

    expect(movements.length).toBeGreaterThanOrEqual(2); // Should have movements from multiple batches

    // Step 4: Verify all movements are linked to one InventoryTransaction
    const transactionIds = new Set(
      movements
        .map((m) => m.inventoryTransactionId)
        .filter((id): id is string => id !== null),
    );
    expect(transactionIds.size).toBe(1); // All movements linked to same transaction

    const transactionId = Array.from(transactionIds)[0];

    // Step 5: Verify STOCK_CHANGED events were emitted for each movement
    const events = await prisma.osEvent.findMany({
      where: {
        type: 'INVENTORY.STOCK_CHANGED',
        payload: {
          path: ['itemId'],
          equals: item.id,
        } as any,
      } as any,
      orderBy: { createdAt: 'asc' },
    });

    // Filter events for this specific transaction
    const transactionEvents = events.filter((e: any) => {
      const payload = e.payload as any;
      return (
        payload.inventoryTransactionId === transactionId &&
        payload.docId === order.id
      );
    });

    expect(transactionEvents.length).toBe(movements.length); // One event per movement

    // Verify each event has correct payload structure
    for (const event of transactionEvents) {
      const payload = event.payload as any;
      expect(payload.eventType).toBe('STOCK_CHANGED');
      expect(payload.eventVersion).toBe(1);
      expect(payload.warehouseId).toBe(warehouse.id);
      expect(payload.itemId).toBe(item.id);
      expect(payload.movementId).toBeTruthy();
      expect(payload.qtyDelta).toBeLessThan(0); // Negative for OUT
      expect(payload.movementType).toBe('OUTCOME');
      expect(payload.inventoryTransactionId).toBe(transactionId); // Same correlationId
      expect(payload.sourceDocType).toBeTruthy();
      expect(payload.sourceDocId).toBeTruthy();
      expect(payload.docType).toBe(InventoryDocumentType.PRODUCTION_INPUT);
      expect(payload.docId).toBe(order.id);
    }

    // Verify batchIds are different for different movements
    const batchIds = transactionEvents
      .map((e: any) => e.payload.batchId)
      .filter((id: any) => id !== null);
    expect(new Set(batchIds).size).toBeGreaterThanOrEqual(2); // Different batches

    // Step 6: Verify inventory report endpoints return all movements
    // (This is a basic check - full implementation would query the report API)
    const allMovementsForItem = await prisma.stockMovement.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    const outMovements = allMovementsForItem.filter(
      (m) => Number(m.quantity) < 0,
    );
    expect(outMovements.length).toBeGreaterThanOrEqual(2);
  });
});


