import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('BCM + ORG full flow (e2e)', () => {
  let app: INestApplication;
  let request: ReturnType<Awaited<typeof createTestApp>>['request'];
  let loginAsAdmin: ReturnType<Awaited<typeof createTestApp>>['loginAsAdmin'];

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create brand, link countries and set legal entity', async () => {
    // 2.1. Логин admin и получение токена
    const accessToken = await loginAsAdmin();
    const auth = () => ({
      get: (url: string) => request().get(url).set('Authorization', `Bearer ${accessToken}`),
      post: (url: string) => request().post(url).set('Authorization', `Bearer ${accessToken}`),
      put: (url: string) => request().put(url).set('Authorization', `Bearer ${accessToken}`),
      patch: (url: string) => request().patch(url).set('Authorization', `Bearer ${accessToken}`),
    });

    // 2.2. Получить список стран
    const countriesRes = await auth().get('/api/org/countries').expect(200);

    expect(Array.isArray(countriesRes.body)).toBe(true);
    expect(countriesRes.body.length).toBeGreaterThanOrEqual(2);

    const [country1, country2] = countriesRes.body;

    // Проверяем, что страны имеют нужные поля
    expect(country1).toHaveProperty('id');
    expect(country1).toHaveProperty('name');
    expect(country1).toHaveProperty('code');
    expect(country2).toHaveProperty('id');
    expect(country2).toHaveProperty('name');
    expect(country2).toHaveProperty('code');

    // 2.3. Создать бренд с одной страной
    const brandCode = `E2E_BRAND_${Date.now()}`;
    const createBrandRes = await auth()
      .post('/api/bcm/brands')
      .send({
        name: 'E2E Test Brand',
        code: brandCode,
        countryIds: [country1.id],
      })
      .expect(201);

    expect(createBrandRes.body).toHaveProperty('id');
    expect(createBrandRes.body).toHaveProperty('name', 'E2E Test Brand');
    expect(createBrandRes.body).toHaveProperty('code', brandCode);

    const brandId = createBrandRes.body.id;

    // Проверяем, что бренд создан с одной страной
    expect(createBrandRes.body.countries).toBeDefined();
    expect(Array.isArray(createBrandRes.body.countries)).toBe(true);
    expect(createBrandRes.body.countries.length).toBe(1);
    expect(createBrandRes.body.countries[0].country.id).toBe(country1.id);

    // 2.4. Добавить бренду вторую страну (ORG endpoint)
    const addCountryRes = await auth()
      .post(`/api/org/brands/${brandId}/countries`)
      .send({
        countryId: country2.id,
      })
      .expect(201);

    expect(addCountryRes.body).toHaveProperty('brandId', brandId);
    expect(addCountryRes.body).toHaveProperty('countryId', country2.id);
    expect(addCountryRes.body.legalEntity).toBeNull();

    // 2.5. Установить юр. лицо для (brandId, country2)
    const legalEntityPayload = {
      name: 'E2E Test Legal Entity',
      inn: '7701234567',
      ogrn: '1234567890123',
      kpp: '770101001',
      legalAddr: 'Moscow, Red Square, 1',
      bankName: 'Test Bank',
      bik: '044525225',
      account: '40702810900000000001',
      corrAccount: '30101810100000000225',
      director: 'John Doe',
    };

    const setLegalEntityRes = await auth()
      .put(`/api/org/brands/${brandId}/countries/${country2.id}/legal-entity`)
      .send(legalEntityPayload)
      .expect(200);

    // Проверяем структуру ответа (возвращается brandCountry с legalEntity)
    expect(setLegalEntityRes.body).toHaveProperty('brandCountry');
    expect(setLegalEntityRes.body.brandCountry).toHaveProperty('legalEntity');
    expect(setLegalEntityRes.body.brandCountry.legalEntity).toHaveProperty('id');
    expect(setLegalEntityRes.body.brandCountry.legalEntity).toMatchObject({
      name: legalEntityPayload.name,
      inn: legalEntityPayload.inn,
      ogrn: legalEntityPayload.ogrn,
    });

    // 2.6. Проверка через GET бренда
    const brandRes = await auth()
      .get(`/api/bcm/brands/${brandId}`)
      .expect(200);

    const brand = brandRes.body;

    expect(brand).toHaveProperty('id', brandId);
    expect(brand).toHaveProperty('name', 'E2E Test Brand');
    expect(brand).toHaveProperty('code', brandCode);

    // Ожидаем 2 страны
    expect(brand.countries).toBeDefined();
    expect(Array.isArray(brand.countries)).toBe(true);
    expect(brand.countries.length).toBe(2);

    // Найти country1 (без legalEntity)
    const brandCountry1 = brand.countries.find(
      (c: any) => c.country.id === country1.id,
    );
    expect(brandCountry1).toBeDefined();
    expect(brandCountry1.country.id).toBe(country1.id);
    expect(brandCountry1.country.code).toBe(country1.code);
    expect(brandCountry1.legalEntity).toBeNull();

    // Найти country2 (с legalEntity)
    const brandCountry2 = brand.countries.find(
      (c: any) => c.country.id === country2.id,
    );
    expect(brandCountry2).toBeDefined();
    expect(brandCountry2.country.id).toBe(country2.id);
    expect(brandCountry2.country.code).toBe(country2.code);

    // Проверить наличие legalEntity
    expect(brandCountry2.legalEntity).not.toBeNull();
    expect(brandCountry2.legalEntity).toMatchObject({
      name: legalEntityPayload.name,
      inn: legalEntityPayload.inn,
      ogrn: legalEntityPayload.ogrn,
      kpp: legalEntityPayload.kpp,
      legalAddr: legalEntityPayload.legalAddr,
      bankName: legalEntityPayload.bankName,
      bik: legalEntityPayload.bik,
      account: legalEntityPayload.account,
      corrAccount: legalEntityPayload.corrAccount,
      director: legalEntityPayload.director,
    });

    // Проверяем в БД напрямую
    const brandCountryDb = await prisma.brandCountry.findUnique({
      where: {
        brandId_countryId: {
          brandId,
          countryId: country2.id,
        },
      },
      include: {
        legalEntity: true,
        country: true,
      },
    });

    expect(brandCountryDb).not.toBeNull();
    expect(brandCountryDb?.legalEntityId).toBeTruthy();
    expect(brandCountryDb?.legalEntity).toHaveProperty('name', legalEntityPayload.name);
    expect(brandCountryDb?.legalEntity).toHaveProperty('inn', legalEntityPayload.inn);

    // Очистка: удаляем созданные данные
    await prisma.brandCountry.deleteMany({
      where: { brandId },
    });
    await prisma.brand.delete({
      where: { id: brandId },
    });
  });
});

