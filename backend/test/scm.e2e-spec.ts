import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('SCM Endpoints (e2e)', () => {
  let app: any;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  let testSupplier: any;
  let testWarehouse: any;
  let testSupply: any;
  let testProductionOrder: any;
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
  });

  afterAll(async () => {
    // Cleanup test data
    if (testProductionOrder) {
      await prisma.productionOrder.deleteMany({ where: { id: testProductionOrder.id } }).catch(() => {});
    }
    if (testSupply) {
      await prisma.scmSupply.deleteMany({ where: { id: testSupply.id } }).catch(() => {});
    }
    if (testWarehouse) {
      await prisma.warehouse.deleteMany({ where: { id: testWarehouse.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.deleteMany({ where: { id: testSupplier.id } }).catch(() => {});
    }
    await app.close();
    await prisma.$disconnect();
  });

  describe('Manufacturers (via Suppliers)', () => {
    it('POST /api/scm/suppliers - should create a manufacturer', async () => {
      const manufacturerData = {
        name: 'Test Manufacturer',
        code: `TEST_MANUFACTURER_${Date.now()}`,
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
        countryId: testCountry?.id,
      };

      const res = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(manufacturerData)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(manufacturerData.name);
      expect(res.body.code).toBe(manufacturerData.code);
      testSupplier = res.body;
    });

    it('GET /api/scm/suppliers?types=MANUFACTURER - should get manufacturers', async () => {
      const res = await request()
        .get('/api/scm/suppliers?types=MANUFACTURER')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const manufacturer = res.body[0];
        expect(manufacturer.id).toBeDefined();
        expect(manufacturer.name).toBeDefined();
      }
    });

    it('GET /api/scm/suppliers?limit=1000 - should clamp limit to 100', async () => {
      const res = await request()
        .get('/api/scm/suppliers?limit=1000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Warehouses', () => {
    it('POST /api/scm/warehouses - should create a warehouse', async () => {
      const warehouseData = {
        name: 'Test Warehouse',
        address: 'Test Address 123',
        isActive: true,
        countryId: testCountry?.id,
      };

      const res = await request()
        .post('/api/scm/warehouses')
        .set('Authorization', `Bearer ${token}`)
        .send(warehouseData)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(warehouseData.name);
      expect(res.body.code).toBeDefined();
      testWarehouse = res.body;
    });

    it('GET /api/scm/warehouses - should get warehouses', async () => {
      const res = await request()
        .get('/api/scm/warehouses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.items)).toBe(true);
      if (res.body.items.length > 0) {
        const warehouse = res.body.items[0];
        expect(warehouse.id).toBeDefined();
        expect(warehouse.name).toBeDefined();
      }
    });

    it('GET /api/scm/warehouses?limit=1000 - should clamp limit to 100', async () => {
      const res = await request()
        .get('/api/scm/warehouses?limit=1000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Supplies', () => {
    it('POST /api/scm/supplies - should create a supply', async () => {
      if (!testSupplier || !testWarehouse) {
        // Create test supplier and warehouse if not exists
        const supplierRes = await request()
          .post('/api/scm/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Supplier for Supply',
            code: `TEST_SUPPLIER_SUPPLY_${Date.now()}`,
            types: ['COMPONENT_SUPPLIER'],
            status: 'ACTIVE',
            countryId: testCountry?.id,
          })
          .expect(201);
        testSupplier = supplierRes.body;

        const warehouseRes = await request()
          .post('/api/scm/warehouses')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Warehouse for Supply',
            address: 'Test Address',
            isActive: true,
            countryId: testCountry?.id,
          })
          .expect(201);
        testWarehouse = warehouseRes.body;
      }

      const supplyData = {
        supplierId: testSupplier.id,
        warehouseId: testWarehouse.id,
        currency: 'RUB',
        status: 'DRAFT',
      };

      const res = await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send(supplyData)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBeDefined();
      expect(res.body.supplierId).toBe(supplyData.supplierId);
      expect(res.body.warehouseId).toBe(supplyData.warehouseId);
      testSupply = res.body;
    });

    it('GET /api/scm/supplies - should get supplies', async () => {
      const res = await request()
        .get('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body) || (res.body.items && Array.isArray(res.body.items))).toBe(true);
    });

    it('GET /api/scm/supplies?limit=1000 - should clamp limit to 100', async () => {
      const res = await request()
        .get('/api/scm/supplies?limit=1000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = Array.isArray(res.body) ? res.body : res.body.items || [];
      expect(items.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Production Orders', () => {
    it('POST /api/scm/production-orders - should create a production order', async () => {
      // Get a product first
      const productsRes = await request()
        .get('/api/scm/products?limit=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const products = Array.isArray(productsRes.body) ? productsRes.body : productsRes.body.items || [];
      if (products.length === 0) {
        // Skip if no products
        return;
      }

      const product = products[0];
      const orderData = {
        productId: product.id,
        quantityPlanned: 100,
        unit: 'pcs',
        name: 'Test Production Order',
      };

      const res = await request()
        .post('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData)
        .expect(201);

      expect(res.body).toHaveProperty('order');
      expect(res.body.order.id).toBeDefined();
      expect(res.body.order.code).toBeDefined();
      testProductionOrder = res.body.order;
    });

    it('GET /api/scm/production-orders - should get production orders', async () => {
      const res = await request()
        .get('/api/scm/production-orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body) || (res.body.items && Array.isArray(res.body.items))).toBe(true);
    });

    it('GET /api/scm/production-orders?limit=1000 - should clamp limit to 100', async () => {
      const res = await request()
        .get('/api/scm/production-orders?limit=1000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = Array.isArray(res.body) ? res.body : res.body.items || [];
      expect(items.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should not return 500 errors', async () => {
      const endpoints = [
        '/api/scm/suppliers',
        '/api/scm/warehouses',
        '/api/scm/supplies',
        '/api/scm/production-orders',
      ];

      for (const endpoint of endpoints) {
        const res = await request()
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).not.toBe(500);
      }
    });
  });
});




