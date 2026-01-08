import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  PrismaClient,
} from '@prisma/client';
import { InventoryDocumentType } from '../src/modules/inventory/inventory.enums';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedWarehouse,
} from './api-seed';

describe('TZ 3.1 — SupplyReceipt Idempotency (e2e)', () => {
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
  let supplyId: string;
  let supplyItemId: string;

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

    item = await seedMdmItem(prisma, request(), token, 'MATERIAL', 'Test Item');

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

    // Create supply
    supplyId = (
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

    // Add supply item
    const supplyItemRes = await request()
      .post(`/api/scm/supplies/${supplyId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        offerId: offer.body.id,
        quantityOrdered: 10,
        unit: 'pcs',
        pricePerUnit: 10,
        currency: 'RUB',
      })
      .expect(201);
    supplyItemId = supplyItemRes.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('should not duplicate batches, movements, transactions, or entries on retry', async () => {
    const receivePayload = {
      items: [
        {
          supplyItemId: supplyItemId,
          quantity: 10,
          pricePerUnit: 10,
          currency: 'RUB',
        },
      ],
    };

    // First receive
    await request()
      .post(`/api/scm/supplies/${supplyId}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send(receivePayload)
      .expect(200);

    // Get counts after first receive
    const receipts1 = await prisma.scmSupplyReceipt.findMany({
      where: { supplyId } as any,
    });
    expect(receipts1.length).toBe(1);
    const receiptId = receipts1[0].id;

    const batches1 = await prisma.stockBatch.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
      } as any,
    });

    const movements1 = await prisma.stockMovement.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
        supplyReceiptId: receiptId,
      } as any,
    });

    const transactions1 = await prisma.inventoryTransaction.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
        docType: InventoryDocumentType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    const entries1 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    // Second receive (retry simulation) - should be idempotent
    await request()
      .post(`/api/scm/supplies/${supplyId}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send(receivePayload)
      .expect(200);

    // Get counts after second receive
    const receipts2 = await prisma.scmSupplyReceipt.findMany({
      where: { supplyId } as any,
    });

    const batches2 = await prisma.stockBatch.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
      } as any,
    });

    const movements2 = await prisma.stockMovement.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
        supplyReceiptId: receiptId,
      } as any,
    });

    const transactions2 = await prisma.inventoryTransaction.findMany({
      where: {
        itemId: item.id,
        warehouseId: warehouse.id,
        docType: InventoryDocumentType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    // Verify no duplicates
    expect(receipts2.length).toBe(receipts1.length);
    expect(batches2.length).toBe(batches1.length);
    expect(movements2.length).toBe(movements1.length);
    expect(transactions2.length).toBe(transactions1.length);
    expect(entries2.length).toBe(entries1.length);

    // Verify idempotency keys are set
    if (transactions2.length > 0) {
      expect(transactions2[0].idempotencyKey).toBeTruthy();
    }
    if (movements2.length > 0) {
      expect(movements2[0].idempotencyKey).toBeTruthy();
    }
  });

  it('should handle parallel receive requests correctly', async () => {
    // Create a new supply for parallel test
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

    const supplyItem2Res = await request()
      .post(`/api/scm/supplies/${supply2Id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        offerId: offer.body.id,
        quantityOrdered: 20,
        unit: 'pcs',
        pricePerUnit: 10,
        currency: 'RUB',
      })
      .expect(201);

    const receivePayload = {
      items: [
        {
          supplyItemId: supplyItem2Res.body.id,
          quantity: 20,
          pricePerUnit: 10,
          currency: 'RUB',
        },
      ],
    };

    // Send 3 parallel receive requests
    const promises = Array.from({ length: 3 }, () =>
      request()
        .post(`/api/scm/supplies/${supply2Id}/receive-partial`)
        .set('Authorization', `Bearer ${token}`)
        .send(receivePayload),
    );

    await Promise.all(promises.map((p) => p.expect(200)));

    // Verify only one receipt was created
    const receipts = await prisma.scmSupplyReceipt.findMany({
      where: { supplyId: supply2Id } as any,
    });
    expect(receipts.length).toBe(1);

    const receiptId = receipts[0].id;

    // Verify only one set of movements/transactions/entries
    const movements = await prisma.stockMovement.findMany({
      where: {
        supplyReceiptId: receiptId,
      } as any,
    });

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        docType: InventoryDocumentType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });

    // Should have exactly one transaction and one entry
    expect(transactions.length).toBe(1);
    expect(entries.length).toBeGreaterThanOrEqual(1); // At least one entry
    expect(movements.length).toBe(1); // One movement for one item
  });
});

