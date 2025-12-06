import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Finance Endpoints (e2e)', () => {
  let app: any;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  let testDocument: any;
  let testSupply: any;
  let testProductionOrder: any;
  let testSupplier: any;
  let testCountry: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    // Get a test country
    const countriesRes = await request()
      .get('/api/org/countries')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const countries = countriesRes.body;
    testCountry = Array.isArray(countries) && countries.length > 0 ? countries[0] : null;

    // Create test supplier
    const supplierRes = await request()
      .post('/api/scm/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Supplier for Finance',
        code: `TEST_SUPPLIER_FINANCE_${Date.now()}`,
        types: ['COMPONENT_SUPPLIER'],
        status: 'ACTIVE',
        countryId: testCountry?.id,
      })
      .expect(201);
    testSupplier = supplierRes.body;

    // Create test warehouse
    const warehouseRes = await request()
      .post('/api/scm/warehouses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Warehouse for Finance',
        address: 'Test Address',
        isActive: true,
        countryId: testCountry?.id,
      })
      .expect(201);
    const testWarehouse = warehouseRes.body;

    // Create test supply
    const supplyRes = await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: testSupplier.id,
        warehouseId: testWarehouse.id,
        currency: 'RUB',
        status: 'DRAFT',
      })
      .expect(201);
    testSupply = supplyRes.body;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testDocument) {
      await prisma.financialDocument.deleteMany({ where: { id: testDocument.id } }).catch(() => {});
    }
    if (testProductionOrder) {
      await prisma.productionOrder.deleteMany({ where: { id: testProductionOrder.id } }).catch(() => {});
    }
    if (testSupply) {
      await prisma.scmSupply.deleteMany({ where: { id: testSupply.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.deleteMany({ where: { id: testSupplier.id } }).catch(() => {});
    }
    await app.close();
    await prisma.$disconnect();
  });

  describe('Finance Documents', () => {
    it('POST /api/finance/documents - should create a finance document', async () => {
      const documentData = {
        type: 'SUPPLY',
        amountTotal: 1000,
        currency: 'RUB',
        scmSupplyId: testSupply.id,
        supplierId: testSupplier.id,
        docDate: new Date().toISOString(),
      };

      const res = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send(documentData)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe(documentData.type);
      expect(res.body.amountTotal).toBeDefined();
      testDocument = res.body;
    });

    it('GET /api/finance/documents - should get finance documents', async () => {
      const res = await request()
        .get('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.items)).toBe(true);
      if (res.body.items.length > 0) {
        const doc = res.body.items[0];
        expect(doc.id).toBeDefined();
        expect(doc.type).toBeDefined();
      }
    });

    it('GET /api/finance/documents?limit=1000 - should clamp limit to 100', async () => {
      const res = await request()
        .get('/api/finance/documents?limit=1000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items.length).toBeLessThanOrEqual(100);
    });

    it('GET /api/finance/documents/:id - should get a single finance document', async () => {
      if (!testDocument) {
        return; // Skip if no document created
      }

      const res = await request()
        .get(`/api/finance/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(testDocument.id);
      expect(res.body.type).toBeDefined();
    });

    it('POST /api/finance/documents - should create document with PRODUCTION type', async () => {
      // Get a product for production order
      const productsRes = await request()
        .get('/api/scm/products?limit=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const products = Array.isArray(productsRes.body) ? productsRes.body : productsRes.body.items || [];
      if (products.length === 0) {
        return; // Skip if no products
      }

      const product = products[0];
      const orderRes = await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.id,
          quantityPlanned: 50,
          unit: 'pcs',
          name: 'Test PO for Finance',
        })
        .expect(201);
      testProductionOrder = orderRes.body.order;

      const documentData = {
        type: 'PRODUCTION',
        amountTotal: 5000,
        currency: 'RUB',
        productionOrderId: testProductionOrder.id,
        docDate: new Date().toISOString(),
      };

      const res = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send(documentData)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('PRODUCTION');
      expect(res.body.productionOrderId).toBe(testProductionOrder.id);
    });
  });

  describe('Error Handling', () => {
    it('should not return 500 errors', async () => {
      const endpoints = [
        '/api/finance/documents',
      ];

      for (const endpoint of endpoints) {
        const res = await request()
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).not.toBe(500);
      }
    });

    it('should handle invalid document creation gracefully', async () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        amountTotal: -100,
      };

      const res = await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      // Should return 400 or 422, not 500
      expect([400, 422]).toContain(res.status);
    });
  });
});




