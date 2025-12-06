import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/database/prisma.service';
import { AppModule } from '../../src/app.module';
import { Country, Brand, Marketplace } from '@prisma/client';
import supertest from 'supertest';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';

describe('Marketplace Integrations e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let request: supertest.SuperTest<supertest.Test>;

  let testCountry: Country;
  let testBrand: Brand;
  let testMarketplace: Marketplace;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Настройки из main.ts
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

    // 1) Берём данные из сидера, а не создаём заново
    testCountry = await prisma.country.findFirstOrThrow({
      where: { code: 'RU' },
    });

    testBrand = await prisma.brand.findFirstOrThrow({
      where: { code: 'TEST_BRAND' },
    });

    testMarketplace = await prisma.marketplace.findFirstOrThrow({
      where: { code: 'OZON' },
    });

    // 2) Очищаем интеграции перед запуском этого сьюта
    await prisma.marketplaceIntegration.deleteMany({});
  });

  afterAll(async () => {
    // Чистим интеграции ещё раз — на случай, если что-то осталось
    if (prisma) {
      await prisma.marketplaceIntegration.deleteMany({});
    }

    if (app) {
      await app.close();
    }
  });

  // Helper для логина админа
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

  it('GET /api/settings/marketplace-integrations should return empty array', async () => {
    // на всякий случай ещё раз чистим только в этом тесте
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const res = await request
      .get('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('POST /api/settings/marketplace-integrations should create integration successfully', async () => {
    // Очищаем перед созданием
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const res = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.marketplace).toHaveProperty('code', 'OZON');
    expect(res.body.brand).toHaveProperty('name', 'Test Brand');
    expect(res.body.country).toHaveProperty('code', 'RU');
    expect(res.body).toHaveProperty('status', 'ACTIVE');
    expect(res.body).toHaveProperty('name');
    expect(res.body.name).toContain('OZON');
    expect(res.body.name).toContain('Test Brand');
    expect(res.body.name).toContain('Russia');
  });

  it('GET /api/settings/marketplace-integrations should return list with 1 element', async () => {
    // Очищаем и создаём одну интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    // создаём одну интеграцию
    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const res = await request
      .get('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(createRes.body.id);

    const integration = res.body[0];
    expect(integration).toHaveProperty('id');
    expect(integration).toHaveProperty('name');
    expect(integration).toHaveProperty('status');
    expect(integration).toHaveProperty('marketplace');
    expect(integration).toHaveProperty('brand');
    expect(integration).toHaveProperty('country');
    expect(integration.marketplace).toHaveProperty('id');
    expect(integration.marketplace).toHaveProperty('code');
    expect(integration.marketplace).toHaveProperty('name');
    expect(integration.brand).toHaveProperty('id');
    expect(integration.brand).toHaveProperty('name');
    expect(integration.country).toHaveProperty('id');
    expect(integration.country).toHaveProperty('code');
    expect(integration.country).toHaveProperty('name');
  });

  it('GET /api/settings/marketplace-integrations/:id should return integration with credentials', async () => {
    // Создаём интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    const res = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('id', integrationId);
    expect(res.body).toHaveProperty('credentials');
    expect(res.body.credentials).toHaveProperty('ozonSellerClientId');
    expect(res.body.credentials).toHaveProperty('ozonSellerHasToken', false);
    expect(res.body.credentials).toHaveProperty('ozonPerfClientId');
    expect(res.body.credentials).toHaveProperty('ozonPerfHasSecret', false);

    // Проверяем, что секретные поля не возвращаются в явном виде
    expect(res.body).not.toHaveProperty('ozonSellerToken');
    expect(res.body).not.toHaveProperty('ozonPerfClientSecret');
    expect(res.body.credentials).not.toHaveProperty('ozonSellerToken');
    expect(res.body.credentials).not.toHaveProperty('ozonPerfClientSecret');
  });

  it('POST /api/settings/marketplace-integrations should return 409 for duplicate combination', async () => {
    // Очищаем перед тестом
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    // первая интеграция — ок
    await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    // вторая — 409
    const res = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(409);

    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('already exists');
  });

  it('PATCH /api/settings/marketplace-integrations/:id should update name and status', async () => {
    // Создаём интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    const res = await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OZON – Test Brand – Russia (updated)',
        status: 'INACTIVE',
      })
      .expect(200);

    expect(res.body).toHaveProperty('name', 'OZON – Test Brand – Russia (updated)');
    expect(res.body).toHaveProperty('status', 'INACTIVE');
  });

  it('PATCH /api/settings/marketplace-integrations/:id should set credentials', async () => {
    // Создаём интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ozonSellerClientId: 'seller-client',
        ozonSellerToken: 'seller-token',
        ozonPerfClientId: 'perf-client',
        ozonPerfClientSecret: 'perf-secret',
      })
      .expect(200);

    // Проверяем через GET запрос
    const getRes = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.credentials).toHaveProperty('ozonSellerClientId', 'seller-client');
    expect(getRes.body.credentials).toHaveProperty('ozonSellerHasToken', true);
    expect(getRes.body.credentials).toHaveProperty('ozonPerfClientId', 'perf-client');
    expect(getRes.body.credentials).toHaveProperty('ozonPerfHasSecret', true);

    // Проверяем, что секреты не видны
    expect(getRes.body).not.toHaveProperty('ozonSellerToken');
    expect(getRes.body).not.toHaveProperty('ozonPerfClientSecret');
    expect(getRes.body.credentials).not.toHaveProperty('ozonSellerToken');
    expect(getRes.body.credentials).not.toHaveProperty('ozonPerfClientSecret');
  });

  it('PATCH /api/settings/marketplace-integrations/:id should clear credentials', async () => {
    // Создаём интеграцию с кредами для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    // Сначала устанавливаем креды
    await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ozonSellerClientId: 'seller-client',
        ozonSellerToken: 'seller-token',
        ozonPerfClientId: 'perf-client',
        ozonPerfClientSecret: 'perf-secret',
      })
      .expect(200);

    // Теперь очищаем токен и секрет
    await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ozonSellerToken: null,
        ozonPerfClientSecret: null,
      })
      .expect(200);

    // Проверяем через GET запрос
    const getRes = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.credentials).toHaveProperty('ozonSellerHasToken', false);
    expect(getRes.body.credentials).toHaveProperty('ozonPerfHasSecret', false);
  });

  it('POST /api/settings/marketplace-integrations/:id/test-connection should succeed with all credentials', async () => {
    // Создаём интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    // Сначала устанавливаем все креды
    await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ozonSellerClientId: 'seller-client',
        ozonSellerToken: 'seller-token',
        ozonPerfClientId: 'perf-client',
        ozonPerfClientSecret: 'perf-secret',
      })
      .expect(200);

    // Получаем текущее состояние для проверки lastSyncAt
    const beforeRes = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const beforeLastSyncAt = beforeRes.body.lastSyncAt;

    // Тестируем подключение
    const testRes = await request
      .post(`/api/settings/marketplace-integrations/${integrationId}/test-connection`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(testRes.body).toHaveProperty('ok', true);
    expect(testRes.body).toHaveProperty('status', 'ACTIVE');
    expect(testRes.body).toHaveProperty('message');

    // Проверяем, что lastSyncAt обновился
    const afterRes = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterRes.body).toHaveProperty('lastSyncAt');
    expect(afterRes.body.lastSyncAt).not.toBeNull();
    if (beforeLastSyncAt) {
      expect(new Date(afterRes.body.lastSyncAt).getTime()).toBeGreaterThan(
        new Date(beforeLastSyncAt).getTime(),
      );
    }
  });

  it('POST /api/settings/marketplace-integrations/:id/test-connection should fail with missing credentials', async () => {
    // Создаём интеграцию для этого теста
    await prisma.marketplaceIntegration.deleteMany({});

    const token = await loginAsAdmin();

    const createRes = await request
      .post('/api/settings/marketplace-integrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marketplaceId: testMarketplace.id,
        brandId: testBrand.id,
        countryId: testCountry.id,
      })
      .expect(201);

    const integrationId = createRes.body.id;

    // Очищаем креды
    await request
      .patch(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ozonSellerClientId: null,
        ozonSellerToken: null,
        ozonPerfClientId: null,
        ozonPerfClientSecret: null,
      })
      .expect(200);

    // Тестируем подключение - должно вернуть ошибку
    const testRes = await request
      .post(`/api/settings/marketplace-integrations/${integrationId}/test-connection`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200); // Сервис возвращает 200 с ok: false

    expect(testRes.body).toHaveProperty('ok', false);
    expect(testRes.body).toHaveProperty('status', 'ERROR');
    expect(testRes.body).toHaveProperty('message');
    expect(testRes.body.message).toContain('Missing');

    // Проверяем, что статус интеграции обновился на ERROR
    const getRes = await request
      .get(`/api/settings/marketplace-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body).toHaveProperty('status', 'ERROR');
  });
});
