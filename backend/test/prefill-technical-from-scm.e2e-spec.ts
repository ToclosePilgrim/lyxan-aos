import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';
import * as supertest from 'supertest';

const prisma = new PrismaClient();

describe('Prefill Technical Data from SCM e2e', () => {
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
        name: 'Test Brand for Prefill',
        code: 'TBPF',
        countryIds: [],
      })
      .expect(201);
    brandId = brandRes.body.id;
  });

  afterAll(async () => {
    await prisma.productContentVersion.deleteMany({ where: { productId } });
    await prisma.sku.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.scmProduct.deleteMany({ where: { id: scmProductId } });
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await app.close();
  });

  it('should successfully prefill technical data from SCM product', async () => {
    // Create SCM product with technical fields
    const scmProductRes = await request
      .post('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalName: 'SCM Product with Technical Data',
        sku: 'SCM_TECH',
        brandId: brandId,
        netWeightGrams: 500,
        grossWeightGrams: 600,
        lengthMm: 200,
        widthMm: 150,
        heightMm: 100,
        barcode: '1234567890123',
        countryOfOriginCode: 'RU',
        technicalAttributes: { material: 'plastic', color: 'white' },
      })
      .expect(201);
    scmProductId = scmProductRes.body.id;

    // Create Product (Listing) with empty technical fields
    const productRes = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Listing for Prefill',
        brandId,
        scmProductId,
        skuCode: 'SKU_PREFILL',
      })
      .expect(201);
    productId = productRes.body.id;

    // Verify initial state - technical fields should be null
    const initialProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(initialProduct?.netWeightGrams).toBeNull();
    expect(initialProduct?.lengthMm).toBeNull();

    // Call prefill endpoint
    const prefillRes = await request
      .post(`/api/bcm/products/${productId}/prefill-technical-from-scm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify technical fields were filled
    expect(prefillRes.body.netWeightGrams).toBe(500);
    expect(prefillRes.body.grossWeightGrams).toBe(600);
    expect(prefillRes.body.lengthMm).toBe(200);
    expect(prefillRes.body.widthMm).toBe(150);
    expect(prefillRes.body.heightMm).toBe(100);
    expect(prefillRes.body.barcode).toBe('1234567890123');
    expect(prefillRes.body.countryOfOriginCode).toBe('RU');
    expect(prefillRes.body.technicalAttributes).toEqual({ material: 'plastic', color: 'white' });

    // Verify scmProductId was not changed
    expect(prefillRes.body.scmProductId).toBe(scmProductId);
  });

  it('should not overwrite existing values in Listing', async () => {
    // Create another SCM product
    const scmProduct2Res = await request
      .post('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalName: 'SCM Product 2',
        sku: 'SCM_TECH2',
        brandId: brandId,
        netWeightGrams: 800,
        lengthMm: 300,
      })
      .expect(201);
    const scmProduct2Id = scmProduct2Res.body.id;

    // Create Product with already set technical fields
    const product2Res = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Listing 2',
        brandId,
        scmProductId: scmProduct2Id,
        skuCode: 'SKU_PREFILL2',
      })
      .expect(201);
    const product2Id = product2Res.body.id;

    // Manually set some technical fields
    await prisma.product.update({
      where: { id: product2Id },
      data: {
        netWeightGrams: 450, // Different from SCM (800)
        lengthMm: 250, // Different from SCM (300)
      },
    });

    // Call prefill
    const prefillRes = await request
      .post(`/api/bcm/products/${product2Id}/prefill-technical-from-scm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify existing values were NOT overwritten
    expect(prefillRes.body.netWeightGrams).toBe(450); // Kept original value
    expect(prefillRes.body.lengthMm).toBe(250); // Kept original value

    // Cleanup
    await prisma.sku.deleteMany({ where: { productId: product2Id } });
    await prisma.product.deleteMany({ where: { id: product2Id } });
    await prisma.scmProduct.deleteMany({ where: { id: scmProduct2Id } });
  });

  it('should return 400 if SCM product is not linked', async () => {
    // Create Product without scmProductId
    const product3Res = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Listing 3',
        brandId,
        scmProductId: 'non-existent-id',
        skuCode: 'SKU_PREFILL3',
      })
      .expect(201);
    const product3Id = product3Res.body.id;

    // Remove scmProductId
    await prisma.product.update({
      where: { id: product3Id },
      data: { scmProductId: null },
    });

    // Call prefill - should return 400
    await request
      .post(`/api/bcm/products/${product3Id}/prefill-technical-from-scm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    // Cleanup
    await prisma.sku.deleteMany({ where: { productId: product3Id } });
    await prisma.product.deleteMany({ where: { id: product3Id } });
  });

  it('should create SYSTEM version after successful prefill', async () => {
    // Use existing product with scmProductId
    const versionsBefore = await prisma.productContentVersion.count({
      where: { productId },
    });

    // Call prefill
    await request
      .post(`/api/bcm/products/${productId}/prefill-technical-from-scm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const versionsAfter = await prisma.productContentVersion.count({
      where: { productId },
    });

    // Should have created a new version
    expect(versionsAfter).toBeGreaterThan(versionsBefore);

    // Check that the version has correct source and comment
    const versions = await prisma.productContentVersion.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const latestVersion = versions[0];
    expect(latestVersion.source).toBe('SYSTEM');
    expect(latestVersion.comment).toBe('Technical data prefilled from SCM product');
  });
});


