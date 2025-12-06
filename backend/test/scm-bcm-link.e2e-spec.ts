import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { AppModule } from '../src/app.module';
import { Brand } from '@prisma/client';
import supertest from 'supertest';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

describe('SCM ↔ BCM Link e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let request: supertest.SuperTest<supertest.Test>;

  let testBrand: Brand;
  let createdScmProductId: string | undefined;
  let createdListingId: string | undefined;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableCors({
      origin: true,
      credentials: true,
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    request = supertest(app.getHttpServer());

    // Используем данные из сидера
    testBrand = await prisma.brand.findFirstOrThrow({
      where: { code: 'TEST_BRAND' },
    });

    // Очищаем перед запуском
    await prisma.product.deleteMany({});
    await prisma.scmProduct.deleteMany({});
  });

  afterAll(async () => {
    // Очищаем созданные данные
    if (prisma) {
      if (createdListingId) {
        await prisma.product.deleteMany({
          where: { id: createdListingId },
        });
      }
      if (createdScmProductId) {
        await prisma.scmProduct.deleteMany({
          where: { id: createdScmProductId },
        });
      }
    }

    if (app) {
      await app.close();
    }
  });

  async function loginAsAdmin(): Promise<string> {
    const res = await request
      .post('/api/auth/login')
      .send({
        email: 'admin@aos.local',
        password: 'Tairai123',
      })
      .expect(200);

    const accessToken = res.body.accessToken;
    if (!accessToken) {
      throw new Error('Failed to get access token from login response');
    }
    return accessToken as string;
  }

  it('POST /api/scm/products should create SCM product successfully', async () => {
    const token = await loginAsAdmin();

    const res = await request
      .post('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalName: 'Test SCM Product',
        sku: 'TEST-SKU',
        brandId: testBrand.id,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('internalName', 'Test SCM Product');
    expect(res.body).toHaveProperty('sku', 'TEST-SKU');
    expect(res.body).toHaveProperty('brandId', testBrand.id);

    createdScmProductId = res.body.id;
  });

  it('POST /api/bcm/products should create BCM listing with scmProductId', async () => {
    if (!createdScmProductId) {
      throw new Error('SCM Product ID not set. Run create SCM product test first.');
    }

    const token = await loginAsAdmin();

    const res = await request
      .post('/api/bcm/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Listing',
        brandId: testBrand.id,
        scmProductId: createdScmProductId,
        skuCode: 'TEST-LISTING-SKU-001',
        skuName: 'Test SKU',
        price: 1000,
        cost: 500,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'Test Listing');
    expect(res.body).toHaveProperty('brandId', testBrand.id);
    expect(res.body).toHaveProperty('scmProductId', createdScmProductId);

    createdListingId = res.body.id;
  });

  it('GET /api/scm/products/:id should return SCM product with linked listings', async () => {
    if (!createdScmProductId) {
      throw new Error('SCM Product ID not set.');
    }

    const token = await loginAsAdmin();

    const res = await request
      .get(`/api/scm/products/${createdScmProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('id', createdScmProductId);
    expect(res.body).toHaveProperty('internalName', 'Test SCM Product');
    expect(res.body).toHaveProperty('listings');
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(res.body.listings.length).toBeGreaterThan(0);

    const listing = res.body.listings.find((l: { id: string }) => l.id === createdListingId);
    expect(listing).toBeDefined();
    expect(listing).toHaveProperty('name', 'Test Listing');
  });

  it('GET /api/bcm/products/:id should return listing with scmProduct', async () => {
    if (!createdListingId) {
      throw new Error('Listing ID not set.');
    }

    const token = await loginAsAdmin();

    const res = await request
      .get(`/api/bcm/products/${createdListingId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('product');
    expect(res.body.product).toHaveProperty('id', createdListingId);
    expect(res.body.product).toHaveProperty('scmProduct');
    expect(res.body.product.scmProduct).toBeDefined();
    expect(res.body.product.scmProduct).toHaveProperty('id', createdScmProductId);
    expect(res.body.product.scmProduct).toHaveProperty('internalName', 'Test SCM Product');
  });
});

