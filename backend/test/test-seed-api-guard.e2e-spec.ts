import { INestApplication } from '@nestjs/common';
// NOTE: don't rely on @prisma/client enum runtime member for freshly-added values (requires prisma generate)
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('DevTools TestSeed API guardrails (e2e)', () => {
  it('is not available when ENABLE_TEST_SEED_API=false (default)', async () => {
    delete process.env.ENABLE_TEST_SEED_API;
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    await request()
      .post('/api/devtools/test-seed/accounting-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404);

    if (app) await app.close();
  });

  it('is available when ENABLE_TEST_SEED_API=true and creates TEST_SEED entry with metadata.source', async () => {
    process.env.ENABLE_TEST_SEED_API = 'true';
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZTS-${ts}`,
      name: 'Z-TestSeed',
    });
    const le = await seedLegalEntity({
      request,
      token,
      code: `LE-TS-${ts}`,
      name: `LE TS ${ts}`,
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token,
      code: `BR-TS-${ts}`,
      name: `Brand TS ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: le.id,
    });

    const res = await request()
      .post('/api/devtools/test-seed/accounting-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: le.id,
        seedId: `seed:${le.id}`,
        docLineId: `docLine:${le.id}:1`,
        debitAccount: '51.00',
        creditAccount: '26.01',
        amount: 10,
        amountBase: 10,
        currency: 'RUB',
        brandId: brand.id,
        countryId: country.id,
      })
      .expect(201);

    expect(res.body.docType).toBe('TEST_SEED');
    expect(res.body.legalEntityId).toBe(le.id);
    expect(res.body.metadata?.source).toBe('TEST_SEED');
    expect(res.body.metadata?.docLineId).toBe(`docLine:${le.id}:1`);

    if (app) await app.close();
  });
});
