import { createTestApp } from './setup-e2e';
import { PrismaClient, ContentChangeSource } from '@prisma/client';
import * as supertest from 'supertest';

const prisma = new PrismaClient();

describe('Product Content Versions e2e', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let token: string;
  let brandId: string;
  let scmProductId: string;
  let productId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request();
    const loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    // Create a brand
    const brandRes = await request
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Brand for Content Versions',
        code: 'TBCV',
        countryIds: [],
      })
      .expect(201);
    brandId = brandRes.body.id;

    // Create an SCM product
    const scmProductRes = await request
      .post('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalName: 'SCM Product for Content Versions',
        sku: 'SCMPCV',
        brandId: brandId,
      })
      .expect(201);
    scmProductId = scmProductRes.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should create a listing and initial SYSTEM version', async () => {
    const createListingRes = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Listing for Versions',
        brandId,
        scmProductId,
        skuCode: 'SKU001',
        mpTitle: 'Initial Title',
        mpDescription: 'Initial Description',
        keywords: 'initial, keywords',
      })
      .expect(201);

    productId = createListingRes.body.id;

    const versionsRes = await request
      .get(`/api/bcm/products/${productId}/content-versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versionsRes.body.length).toBeGreaterThanOrEqual(1);
    const initialVersion = versionsRes.body.find(
      (v: any) => v.source === 'SYSTEM',
    );
    expect(initialVersion).toBeDefined();
    expect(initialVersion.comment).toBe('Initial version');
    expect(initialVersion.mpTitle).toBe('Initial Title');
    expect(initialVersion.mpDescription).toBe('Initial Description');
    expect(initialVersion.keywords).toBe('initial, keywords');
  });

  it('should create a MANUAL version when content is updated via PATCH', async () => {
    const versionsBefore = await prisma.productContentVersion.count({
      where: { productId },
    });

    await request
      .patch(`/api/bcm/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mpTitle: 'Updated Title V1',
        keywords: 'updated, keywords, v1',
      })
      .expect(200);

    const versionsAfter = await prisma.productContentVersion.count({
      where: { productId },
    });

    expect(versionsAfter).toBe(versionsBefore + 1);

    const versionsRes = await request
      .get(`/api/bcm/products/${productId}/content-versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const manualVersion = versionsRes.body.find(
      (v: any) => v.source === 'MANUAL',
    );
    expect(manualVersion).toBeDefined();
    expect(manualVersion.comment).toBe('Manual update via UI');
    expect(manualVersion.mpTitle).toBe('Updated Title V1');
    expect(manualVersion.keywords).toBe('updated, keywords, v1');
  });

  it('should create an AI version when content is updated via /ai-content endpoint', async () => {
    const versionsBefore = await prisma.productContentVersion.count({
      where: { productId },
    });

    await request
      .post(`/api/bcm/products/${productId}/ai-content`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        mpTitle: 'AI Generated Title',
        mpDescription: 'AI Generated Description',
        keywords: 'ai, generated, keywords',
      })
      .expect(200);

    const versionsAfter = await prisma.productContentVersion.count({
      where: { productId },
    });

    expect(versionsAfter).toBe(versionsBefore + 1);

    const versionsRes = await request
      .get(`/api/bcm/products/${productId}/content-versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const aiVersion = versionsRes.body.find((v: any) => v.source === 'AI');
    expect(aiVersion).toBeDefined();
    expect(aiVersion.agentLabel).toBe('ozon-content-agent-v1');
    expect(aiVersion.comment).toBe('AI content update');
    expect(aiVersion.mpTitle).toBe('AI Generated Title');
    expect(aiVersion.mpDescription).toBe('AI Generated Description');
    expect(aiVersion.keywords).toBe('ai, generated, keywords');
  });

  it('GET /api/bcm/products/:productId/content-versions/:versionId should return a specific version', async () => {
    const versionsRes = await request
      .get(`/api/bcm/products/${productId}/content-versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versionsRes.body.length).toBeGreaterThan(0);
    const firstVersion = versionsRes.body[0];

    const versionRes = await request
      .get(`/api/bcm/products/${productId}/content-versions/${firstVersion.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versionRes.body.id).toBe(firstVersion.id);
    expect(versionRes.body.productId).toBe(productId);
    expect(versionRes.body.source).toBeDefined();
    expect(versionRes.body.createdAt).toBeDefined();
  });

  it('GET /api/bcm/products/:productId/content-versions/:versionId should return 404 for non-existent version', async () => {
    await request
      .get(`/api/bcm/products/${productId}/content-versions/non-existent-id`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /api/bcm/products/:productId/content-versions/:versionId should return 404 if version does not belong to product', async () => {
    // Create another product and its version
    const anotherProductRes = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Another Product',
        brandId,
        scmProductId,
        skuCode: 'SKU002',
        mpTitle: 'Another Title',
      })
      .expect(201);
    const anotherProductId = anotherProductRes.body.id;

    const anotherVersionsRes = await request
      .get(`/api/bcm/products/${anotherProductId}/content-versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const anotherVersionId = anotherVersionsRes.body[0].id;

    // Try to get another product's version using the current productId
    await request
      .get(
        `/api/bcm/products/${productId}/content-versions/${anotherVersionId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
