import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('BCM Brands e2e', () => {
  it('GET /api/bcm/brands should return array', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const res = await request()
      .get('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    await app.close();
  });

  it('GET /api/bcm/brands should return brands with countries', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const res = await request()
      .get('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const brand = res.body[0];
      expect(brand).toHaveProperty('id');
      expect(brand).toHaveProperty('name');
      expect(brand).toHaveProperty('code');
      expect(brand).toHaveProperty('countries');
      expect(Array.isArray(brand.countries)).toBe(true);
      expect(brand).toHaveProperty('created_at');
    }

    await app.close();
  });

  it('POST /api/bcm/brands should create brand with multiple countries', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Найдём хотя бы одну страну из сидов
    const countries = await prisma.country.findMany();
    expect(countries.length).toBeGreaterThan(0);

    const countryIds = countries.map((c) => c.id).slice(0, 2); // максимум 2

    const res = await request()
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Brand E2E',
        code: 'TEST_BRAND_E2E',
        countryIds,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'Test Brand E2E');
    expect(res.body).toHaveProperty('code', 'TEST_BRAND_E2E');
    expect(res.body).toHaveProperty('countries');
    expect(Array.isArray(res.body.countries)).toBe(true);
    expect(res.body.countries.length).toBe(countryIds.length);

    // Проверяем, что связи создались в БД
    const brandCountries = await prisma.brandCountry.findMany({
      where: { brandId: res.body.id },
    });
    expect(brandCountries.length).toBe(countryIds.length);

    // Очистка: удаляем созданный бренд
    await prisma.brandCountry.deleteMany({
      where: { brandId: res.body.id },
    });
    await prisma.brand.delete({
      where: { id: res.body.id },
    });

    await app.close();
  });

  it('POST /api/bcm/brands should create brand with description and toneOfVoice', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Найдём хотя бы одну страну из сидов
    const countries = await prisma.country.findMany();
    expect(countries.length).toBeGreaterThan(0);

    const countryIds = countries.map((c) => c.id).slice(0, 1);

    const payload = {
      name: 'Test Brand for Marketplace',
      code: 'TEST_BRAND_DESC_E2E',
      countryIds,
      description: 'Test brand for marketplace experiments.',
      toneOfVoice: 'Friendly, expert, a bit playful.',
    };

    const res = await request()
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', payload.name);
    expect(res.body).toHaveProperty('code', payload.code);
    expect(res.body).toHaveProperty('description', payload.description);
    expect(res.body).toHaveProperty('toneOfVoice', payload.toneOfVoice);

    // Очистка: удаляем созданный бренд
    await prisma.brandCountry.deleteMany({
      where: { brandId: res.body.id },
    });
    await prisma.brand.delete({
      where: { id: res.body.id },
    });

    await app.close();
  });

  it('GET /api/bcm/brands/:id should return brand by id', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Сначала получаем список брендов
    const brandsRes = await request()
      .get('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(brandsRes.body)).toBe(true);

    if (brandsRes.body.length > 0) {
      const brandId = brandsRes.body[0].id;

      const res = await request()
        .get(`/api/bcm/brands/${brandId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', brandId);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('countries');
    }

    await app.close();
  });

  it('PATCH /api/bcm/brands/:id should update brand with multiple countries', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Создаём бренд для теста
    const countries = await prisma.country.findMany();
    expect(countries.length).toBeGreaterThan(0);

    const createRes = await request()
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Brand Update E2E',
        code: 'TEST_BRAND_UPDATE_E2E',
        countryIds: [countries[0].id],
      })
      .expect(201);

    const brandId = createRes.body.id;

    // Обновляем бренд с несколькими странами
    const allCountryIds = countries.map((c) => c.id).slice(0, 2);

    const updateRes = await request()
      .patch(`/api/bcm/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Test Brand E2E',
        countryIds: allCountryIds,
      })
      .expect(200);

    expect(updateRes.body).toHaveProperty('name', 'Updated Test Brand E2E');
    expect(updateRes.body.countries.length).toBe(allCountryIds.length);

    // Проверяем в БД
    const brandCountries = await prisma.brandCountry.findMany({
      where: { brandId },
    });
    expect(brandCountries.length).toBe(allCountryIds.length);

    // Очистка
    await prisma.brandCountry.deleteMany({
      where: { brandId },
    });
    await prisma.brand.delete({
      where: { id: brandId },
    });

    await app.close();
  });

  it('PATCH /api/bcm/brands/:id should update description and toneOfVoice', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Создаём бренд для теста
    const countries = await prisma.country.findMany();
    expect(countries.length).toBeGreaterThan(0);

    const createRes = await request()
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Brand Update Fields E2E',
        code: 'TEST_BRAND_UPDATE_FIELDS_E2E',
        countryIds: [countries[0].id],
      })
      .expect(201);

    const brandId = createRes.body.id;

    // Обновляем description и toneOfVoice
    const updateRes = await request()
      .patch(`/api/bcm/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Updated brand description for testing.',
        toneOfVoice: 'Updated tone: professional and approachable.',
      })
      .expect(200);

    expect(updateRes.body).toHaveProperty('description', 'Updated brand description for testing.');
    expect(updateRes.body).toHaveProperty('toneOfVoice', 'Updated tone: professional and approachable.');

    // Проверяем через GET запрос
    const getRes = await request()
      .get(`/api/bcm/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body).toHaveProperty('description', 'Updated brand description for testing.');
    expect(getRes.body).toHaveProperty('toneOfVoice', 'Updated tone: professional and approachable.');

    // Очистка
    await prisma.brandCountry.deleteMany({
      where: { brandId },
    });
    await prisma.brand.delete({
      where: { id: brandId },
    });

    await app.close();
  });

  it('POST /api/org/brands/:brandId/countries and PUT /api/org/brands/:brandId/countries/:countryId/legal-entity should create brand, add country, and set legal entity', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // Получаем страны
    const countries = await prisma.country.findMany();
    expect(countries.length).toBeGreaterThan(0);
    const countryId = countries[0].id;

    // Создаём бренд
    const createBrandRes = await request()
      .post('/api/bcm/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Brand Legal Entity E2E',
        code: 'TEST_BRAND_LE_E2E',
        countryIds: [],
      })
      .expect(201);

    const brandId = createBrandRes.body.id;

    // Добавляем страну к бренду
    const addCountryRes = await request()
      .post(`/api/org/brands/${brandId}/countries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ countryId })
      .expect(201);

    expect(addCountryRes.body).toHaveProperty('brandId', brandId);
    expect(addCountryRes.body).toHaveProperty('countryId', countryId);
    expect(addCountryRes.body.legalEntity).toBeNull();

    // Создаём юридическое лицо
    const legalEntityData = {
      name: 'ООО «Вимти Россия»',
      inn: '1234567890',
      kpp: '123456789',
      ogrn: '1234567890123',
      legalAddr: 'г. Москва, ул. Тестовая, д. 1',
      bankName: 'ПАО «Банк»',
      bik: '044525225',
      account: '40702810123456789012',
      corrAccount: '30101810100000000593',
      director: 'Иванов Иван Иванович',
    };

    const legalEntityRes = await request()
      .put(`/api/org/brands/${brandId}/countries/${countryId}/legal-entity`)
      .set('Authorization', `Bearer ${token}`)
      .send(legalEntityData)
      .expect(200);

    // Проверяем структуру ответа (возвращается brandCountry с legalEntity)
    expect(legalEntityRes.body).toHaveProperty('brandCountry');
    expect(legalEntityRes.body.brandCountry).toHaveProperty('legalEntity');
    expect(legalEntityRes.body.brandCountry.legalEntity).toHaveProperty('name', legalEntityData.name);
    expect(legalEntityRes.body.brandCountry.legalEntity).toHaveProperty('inn', legalEntityData.inn);

    // Проверяем, что бренд возвращает страну с юридическим лицом
    const brandRes = await request()
      .get(`/api/bcm/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(brandRes.body).toHaveProperty('countries');
    expect(Array.isArray(brandRes.body.countries)).toBe(true);
    expect(brandRes.body.countries.length).toBe(1);
    expect(brandRes.body.countries[0]).toHaveProperty('country');
    expect(brandRes.body.countries[0]).toHaveProperty('legalEntity');
    expect(brandRes.body.countries[0].legalEntity).not.toBeNull();
    expect(brandRes.body.countries[0].legalEntity).toHaveProperty('name', legalEntityData.name);
    expect(brandRes.body.countries[0].legalEntity).toHaveProperty('inn', legalEntityData.inn);

    // Проверяем в БД
    const brandCountry = await prisma.brandCountry.findUnique({
      where: {
        brandId_countryId: {
          brandId,
          countryId,
        },
      },
      include: {
        legalEntity: true,
      },
    });

    expect(brandCountry).not.toBeNull();
    expect(brandCountry?.legalEntityId).toBeTruthy();
    expect(brandCountry?.legalEntity).toHaveProperty('name', legalEntityData.name);

    // Очистка
    await prisma.brandCountry.deleteMany({
      where: { brandId },
    });
    await prisma.brand.delete({
      where: { id: brandId },
    });

    await app.close();
  });
});

