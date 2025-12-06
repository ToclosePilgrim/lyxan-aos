import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Listing Content Versions (e2e)', () => {
  let app: any;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Version creation on content update', () => {
    it('should create a version when content fields are updated', async () => {
      const token = await loginAsAdmin();

      // Get test brand from seeder
      const testBrand = await prisma.brand.findFirstOrThrow({
        where: { code: 'TEST_BRAND' },
      });
      const brandId = testBrand.id;

      // Create SCM product for this test
      const scmProductRes = await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brandId,
          internalName: 'Test SCM Product for versions',
          sku: 'SCM_VERSION_TEST',
          baseDescription: 'Test product for listing versions',
          composition: 'Test composition',
        })
        .expect(201);

      const scmProductId = scmProductRes.body.id;

      // Create a listing
      const createRes = await request()
        .post('/api/bcm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Listing for Versions',
          brandId,
          scmProductId,
          skuCode: 'TEST-VERSION-SKU-001',
        })
        .expect(201);

      const listingId = createRes.body.id;
      expect(listingId).toBeDefined();

      // Initially, there should be no versions
      const versionsBeforeRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(versionsBeforeRes.body)).toBe(true);
      expect(versionsBeforeRes.body.length).toBe(0);

      // Update content fields
      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Title',
          keywords: 'test, keywords, updated',
        })
        .expect(200);

      // Check that a version was created
      const versionsAfterRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(versionsAfterRes.body)).toBe(true);
      expect(versionsAfterRes.body.length).toBe(1);

      const version = versionsAfterRes.body[0];
      expect(version.versionNumber).toBe(1);
      expect(version.source).toBe('MANUAL');
      expect(version.title).toBe('Updated Title');
      expect(version.keywords).toBe('test, keywords, updated');
    });

    it('should increment version numbers correctly', async () => {
      const token = await loginAsAdmin();

      // Get test brand from seeder
      const testBrand = await prisma.brand.findFirstOrThrow({
        where: { code: 'TEST_BRAND' },
      });
      const brandId = testBrand.id;

      // Create SCM product for this test
      const scmProductRes = await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brandId,
          internalName: 'Test SCM Product for version numbers',
          sku: 'SCM_VERSION_TEST_002',
          baseDescription: 'Test product for version numbers',
        })
        .expect(201);

      const scmProductId = scmProductRes.body.id;

      // Create a listing
      const createRes = await request()
        .post('/api/bcm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Listing for Version Numbers',
          brandId,
          scmProductId,
          skuCode: 'TEST-VERSION-SKU-002',
        })
        .expect(201);

      const listingId = createRes.body.id;

      // Make multiple updates
      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Version 1 Title' })
        .expect(200);

      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Version 2 Title' })
        .expect(200);

      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ keywords: 'version 3 keywords' })
        .expect(200);

      // Check versions
      const versionsRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const versions = versionsRes.body;
      expect(versions.length).toBe(3);

      // Versions should be ordered by versionNumber desc
      expect(versions[0].versionNumber).toBe(3);
      expect(versions[1].versionNumber).toBe(2);
      expect(versions[2].versionNumber).toBe(1);
    });

    it('should create version when saveVersion flag is set', async () => {
      const token = await loginAsAdmin();

      // Get test brand from seeder
      const testBrand = await prisma.brand.findFirstOrThrow({
        where: { code: 'TEST_BRAND' },
      });
      const brandId = testBrand.id;

      // Create SCM product for this test
      const scmProductRes = await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brandId,
          internalName: 'Test SCM Product for saveVersion',
          sku: 'SCM_VERSION_TEST_003',
          baseDescription: 'Test product for saveVersion',
        })
        .expect(201);

      const scmProductId = scmProductRes.body.id;

      // Create a listing with initial content
      const createRes = await request()
        .post('/api/bcm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Listing for SaveVersion',
          brandId,
          scmProductId,
          skuCode: 'TEST-VERSION-SKU-003',
          title: 'Initial Title',
        })
        .expect(201);

      const listingId = createRes.body.id;

      // Update with same content but saveVersion=true
      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Initial Title', // Same value
          saveVersion: true,
        })
        .expect(200);

      // Check that a version was created
      const versionsRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(versionsRes.body.length).toBe(1);
      expect(versionsRes.body[0].versionNumber).toBe(1);
      expect(versionsRes.body[0].reason).toBe('Manual content update');
    });

    it('should not create version when non-content fields are updated', async () => {
      const token = await loginAsAdmin();

      // Get test brand from seeder
      const testBrand = await prisma.brand.findFirstOrThrow({
        where: { code: 'TEST_BRAND' },
      });
      const brandId = testBrand.id;

      // Create SCM product for this test
      const scmProductRes = await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brandId,
          internalName: 'Test SCM Product for non-content update',
          sku: 'SCM_VERSION_TEST_004',
          baseDescription: 'Test product for non-content update',
        })
        .expect(201);

      const scmProductId = scmProductRes.body.id;

      // Create a listing
      const createRes = await request()
        .post('/api/bcm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Listing for Non-Content Update',
          brandId,
          scmProductId,
          skuCode: 'TEST-VERSION-SKU-004',
        })
        .expect(201);

      const listingId = createRes.body.id;

      // Update non-content field (name)
      await request()
        .patch(`/api/scm/products/${listingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
        })
        .expect(200);

      // Check that no version was created
      const versionsRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(versionsRes.body.length).toBe(0);
    });
  });

  describe('GET /api/bcm/products/:id/versions', () => {
    it('should return empty array for listing without versions', async () => {
      const token = await loginAsAdmin();

      // Get test brand from seeder
      const testBrand = await prisma.brand.findFirstOrThrow({
        where: { code: 'TEST_BRAND' },
      });
      const brandId = testBrand.id;

      // Create SCM product for this test
      const scmProductRes = await request()
        .post('/api/scm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brandId,
          internalName: 'Test SCM Product for empty versions',
          sku: 'SCM_VERSION_TEST_005',
          baseDescription: 'Test product for empty versions',
        })
        .expect(201);

      const scmProductId = scmProductRes.body.id;

      // Create a listing
      const createRes = await request()
        .post('/api/bcm/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Listing Empty Versions',
          brandId,
          scmProductId,
          skuCode: 'TEST-VERSION-SKU-005',
        })
        .expect(201);

      const listingId = createRes.body.id;

      const versionsRes = await request()
        .get(`/api/bcm/products/${listingId}/versions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(versionsRes.body)).toBe(true);
      expect(versionsRes.body.length).toBe(0);
    });
  });
});


