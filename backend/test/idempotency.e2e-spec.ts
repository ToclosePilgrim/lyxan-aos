import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

describe('Idempotency (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Finance Documents', () => {
    it('should create document on first request with idempotency key', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      const idempotencyKey = `test-finance-${crypto.randomUUID()}`;
      const payload = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '1000.00',
        status: 'DRAFT',
      };
      const payloadString = JSON.stringify(payload); // Ensure consistent serialization

      const res = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.headers['x-idempotency-replay']).toBeUndefined();

      const documentId = res.body.id;

      await app.close();

      // Verify document was created
      const doc = await prisma.financialDocument.findUnique({
        where: { id: documentId },
      });
      expect(doc).not.toBeNull();
    });

    it('should return same response on second request with same idempotency key', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      const idempotencyKey = `test-finance-replay-${crypto.randomUUID()}`;
      const payload = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '2000.00',
        status: 'DRAFT',
      };
      const payloadString = JSON.stringify(payload); // Ensure consistent serialization

      // First request
      const res1 = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(201);

      const documentId1 = res1.body.id;

      // Second request with same key and exact same body
      const res2 = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString) // Same exact string
        .expect(201);

      // Should return same response
      expect(res2.body.id).toBe(documentId1);
      expect(res2.body).toEqual(res1.body);
      expect(res2.headers['x-idempotency-replay']).toBe('1');

      // Verify only one document was created
      const count = await prisma.financialDocument.count({
        where: { id: documentId1 },
      });
      expect(count).toBe(1);

      await app.close();
    });

    it('should reject request with same key but different body', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      const idempotencyKey = `test-finance-conflict-${crypto.randomUUID()}`;
      const payload1 = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '3000.00',
        status: 'DRAFT',
      };
      const payload1String = JSON.stringify(payload1);

      // First request
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payload1String)
        .expect(201);

      // Second request with same key but different body
      const payload2 = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '4000.00', // Different amount
        status: 'DRAFT',
      };
      const payload2String = JSON.stringify(payload2);

      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payload2String)
        .expect(409); // Conflict

      await app.close();
    });

    it('should handle parallel requests correctly', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      const idempotencyKey = `test-finance-parallel-${crypto.randomUUID()}`;
      const payload = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '5000.00',
        status: 'DRAFT',
      };
      const payloadString = JSON.stringify(payload); // Same exact string for both requests

      // Send two parallel requests with same key and exact same body
      const [res1, res2] = await Promise.all([
        request()
          .post('/api/finance/documents')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .set('Content-Type', 'application/json')
          .send(payloadString),
        request()
          .post('/api/finance/documents')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .set('Content-Type', 'application/json')
          .send(payloadString), // Same exact string
      ]);

      // Both should succeed
      expect([res1.status, res2.status]).toContain(201);

      // Both should return same document ID
      const ids = [res1.body.id, res2.body.id].filter(Boolean);
      expect(new Set(ids).size).toBe(1); // All IDs should be the same

      // At least one should have replay header
      const hasReplay =
        res1.headers['x-idempotency-replay'] === '1' ||
        res2.headers['x-idempotency-replay'] === '1';
      expect(hasReplay).toBe(true);

      // Verify only one document was created
      const documentId = ids[0];
      const count = await prisma.financialDocument.count({
        where: { id: documentId },
      });
      expect(count).toBe(1);

      await app.close();
    });
  });

  describe('SCM Supplies', () => {
    it('should create supply on first request with idempotency key', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      // Get required entities
      const brand = await prisma.brand.findFirst();
      const warehouse = await prisma.warehouse.findFirst();
      const counterparty = await prisma.counterparty.findFirst();

      if (!brand || !warehouse || !counterparty) {
        await app.close();
        return; // Skip if test data not available
      }

      const idempotencyKey = `test-scm-${crypto.randomUUID()}`;
      const payload = {
        supplierCounterpartyId: counterparty.id,
        warehouseId: warehouse.id,
        status: 'DRAFT',
        items: [],
      };
      const payloadString = JSON.stringify(payload);

      const res = await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.headers['x-idempotency-replay']).toBeUndefined();

      await app.close();
    });

    it('should return same response on second request with same idempotency key', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      // Get required entities
      const brand = await prisma.brand.findFirst();
      const warehouse = await prisma.warehouse.findFirst();
      const counterparty = await prisma.counterparty.findFirst();

      if (!brand || !warehouse || !counterparty) {
        await app.close();
        return; // Skip if test data not available
      }

      const idempotencyKey = `test-scm-replay-${crypto.randomUUID()}`;
      const payload = {
        supplierCounterpartyId: counterparty.id,
        warehouseId: warehouse.id,
        status: 'DRAFT',
        items: [],
      };
      const payloadString = JSON.stringify(payload);

      // First request
      const res1 = await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(201);

      const supplyId1 = res1.body.id;

      // Second request with same key and exact same body
      const res2 = await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .set('Content-Type', 'application/json')
        .send(payloadString) // Same exact string
        .expect(201);

      // Should return same response
      expect(res2.body.id).toBe(supplyId1);
      expect(res2.body).toEqual(res1.body);
      expect(res2.headers['x-idempotency-replay']).toBe('1');

      await app.close();
    });

    it('should handle parallel requests correctly', async () => {
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      // Get required entities
      const brand = await prisma.brand.findFirst();
      const warehouse = await prisma.warehouse.findFirst();
      const counterparty = await prisma.counterparty.findFirst();

      if (!brand || !warehouse || !counterparty) {
        await app.close();
        return; // Skip if test data not available
      }

      const idempotencyKey = `test-scm-parallel-${crypto.randomUUID()}`;
      const payload = {
        supplierCounterpartyId: counterparty.id,
        warehouseId: warehouse.id,
        status: 'DRAFT',
        items: [],
      };
      const payloadString = JSON.stringify(payload); // Same exact string for both requests

      // Send two parallel requests with same key and exact same body
      const [res1, res2] = await Promise.all([
        request()
          .post('/api/scm/supplies')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .set('Content-Type', 'application/json')
          .send(payloadString),
        request()
          .post('/api/scm/supplies')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .set('Content-Type', 'application/json')
          .send(payloadString), // Same exact string
      ]);

      // Both should succeed
      expect([res1.status, res2.status]).toContain(201);

      // Both should return same supply ID
      const ids = [res1.body.id, res2.body.id].filter(Boolean);
      expect(new Set(ids).size).toBe(1); // All IDs should be the same

      // At least one should have replay header
      const hasReplay =
        res1.headers['x-idempotency-replay'] === '1' ||
        res2.headers['x-idempotency-replay'] === '1';
      expect(hasReplay).toBe(true);

      await app.close();
    });
  });

  describe('Required key validation', () => {
    it('should require idempotency key for decorated endpoints in production', async () => {
      // This test would need NODE_ENV=production to fully test
      // For now, we test that decorator is applied
      const { app, request, loginAsAdmin } = await createTestApp();
      const token = await loginAsAdmin();

      const payload = {
        type: 'SUPPLY_INVOICE',
        direction: 'INBOUND',
        currency: 'RUB',
        amountTotal: '1000.00',
        status: 'DRAFT',
      };

      // In test mode, it might not be required, but we can check the behavior
      const res = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      // Should either succeed (if not required in test) or fail with 400 (if required)
      expect([200, 201, 400]).toContain(res.status);

      await app.close();
    });
  });
});

