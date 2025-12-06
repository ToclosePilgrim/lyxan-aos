import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';
import { SupplierRole } from '@aos/shared';

const prisma = new PrismaClient();

describe('SCM Suppliers API (e2e)', () => {
  let app: any;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  let testSupplier: any;
  let testScmProduct: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();
  });

  afterAll(async () => {
    // Cleanup
    if (testScmProduct) {
      await prisma.scmProductSupplier.deleteMany({ where: { scmProductId: testScmProduct.id } }).catch(() => {});
      await prisma.scmProduct.deleteMany({ where: { id: testScmProduct.id } }).catch(() => {});
    }
    if (testSupplier) {
      await prisma.supplier.deleteMany({ where: { id: testSupplier.id } }).catch(() => {});
    }
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/scm/suppliers', () => {
    it('should create a supplier with minimal valid payload', async () => {
      const supplierData = {
        name: 'Test Supplier API',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };

      const response = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(supplierData.name);
      expect(response.body.code).toBeDefined();
      
      testSupplier = response.body;
    });
  });

  describe('GET /api/scm/suppliers', () => {
    it('should get list of suppliers', async () => {
      const response = await request()
        .get('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/scm/suppliers/:id/items', () => {
    beforeEach(async () => {
      if (!testSupplier) {
        const supplierData = {
          name: 'Test Supplier Items',
          types: ['MANUFACTURER'],
          status: 'ACTIVE',
        };
        const response = await request()
          .post('/api/scm/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send(supplierData)
          .expect(201);
        testSupplier = response.body;
      }
    });

    it('should get items with isActive=true', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${testSupplier.id}/items?isActive=true`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get items with isActive=false', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${testSupplier.id}/items?isActive=false`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle limit=1000 and return <=100 items', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${testSupplier.id}/items?limit=1000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/scm/suppliers/:id/services', () => {
    beforeEach(async () => {
      if (!testSupplier) {
        const supplierData = {
          name: 'Test Supplier Services',
          types: ['MANUFACTURER'],
          status: 'ACTIVE',
        };
        const response = await request()
          .post('/api/scm/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send(supplierData)
          .expect(201);
        testSupplier = response.body;
      }
    });

    it('should get services with isActive=true', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${testSupplier.id}/services?isActive=true`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get services with isActive=false', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${testSupplier.id}/services?isActive=false`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/scm/suppliers/:id/link-product', () => {
    beforeEach(async () => {
      if (!testSupplier) {
        const supplierData = {
          name: 'Test Supplier Link',
          types: ['MANUFACTURER'],
          status: 'ACTIVE',
        };
        const response = await request()
          .post('/api/scm/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send(supplierData)
          .expect(201);
        testSupplier = response.body;
      }

      // Create a test SCM product
      if (!testScmProduct) {
        const brand = await prisma.brand.findFirst();
        if (!brand) {
          throw new Error('No brand found for test');
        }

        testScmProduct = await prisma.scmProduct.create({
          data: {
            internalName: 'Test Product for Link',
            brandId: brand.id,
            type: 'PURCHASED',
          },
        });
      }
    });

    it('should link product with role from enum', async () => {
      const linkData = {
        scmProductId: testScmProduct.id,
        role: SupplierRole.PRODUCER,
        leadTimeDays: 7,
        minOrderQty: 100,
      };

      const response = await request()
        .post(`/api/scm/suppliers/${testSupplier.id}/link-product`)
        .set('Authorization', `Bearer ${token}`)
        .send(linkData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.role).toBe(SupplierRole.PRODUCER);
      expect(response.body.scmProductId).toBe(testScmProduct.id);
    });
  });

  describe('GET /api/scm/suppliers/:id - supplier detail with linked products', () => {
    let supplierWithLink: any;
    let linkedProduct: any;

    beforeEach(async () => {
      // Create supplier
      const supplierData = {
        name: 'Test Supplier Detail',
        types: ['MANUFACTURER'],
        status: 'ACTIVE',
      };
      const supplierRes = await request()
        .post('/api/scm/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send(supplierData)
        .expect(201);
      supplierWithLink = supplierRes.body;

      // Create and link product
      const brand = await prisma.brand.findFirst();
      if (!brand) {
        throw new Error('No brand found for test');
      }

      const product = await prisma.scmProduct.create({
        data: {
          internalName: 'Test Product Detail',
          brandId: brand.id,
          type: 'PURCHASED',
        },
      });

      const linkRes = await request()
        .post(`/api/scm/suppliers/${supplierWithLink.id}/link-product`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          scmProductId: product.id,
          role: SupplierRole.PRODUCER,
        })
        .expect(201);
      linkedProduct = linkRes.body;
    });

    afterEach(async () => {
      if (linkedProduct) {
        await prisma.scmProductSupplier.deleteMany({ where: { id: linkedProduct.id } }).catch(() => {});
      }
      if (supplierWithLink) {
        await prisma.supplier.deleteMany({ where: { id: supplierWithLink.id } }).catch(() => {});
      }
    });

    it('should return supplier with linked products without 5xx', async () => {
      const response = await request()
        .get(`/api/scm/suppliers/${supplierWithLink.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.status).toBeLessThan(300);
      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(supplierWithLink.id);
      expect(Array.isArray(response.body.scmProductLinks)).toBe(true);
      
      if (response.body.scmProductLinks.length > 0) {
        const link = response.body.scmProductLinks[0];
        expect(link).toBeDefined();
        expect(link.scmProduct).toBeDefined();
        expect(link.scmProduct.id).toBeDefined();
      }
    });
  });
});

