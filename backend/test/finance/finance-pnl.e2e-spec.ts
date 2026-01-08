import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from '../api-seed';

describe('Finance PnL (ledger-based)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    process.env.ENABLE_TEST_SEED_API = 'true';
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZPNL-${ts}`,
      name: 'Z-PnL',
    });
    const legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PNL-${ts}`,
      name: `LE PnL ${ts}`,
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token,
      code: `BR-PNL-${ts}`,
      name: `Brand PnL ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    const postingDate = today.toISOString().slice(0, 10);
    const seedId = `finance-pnl:${ts}`;

    const seed = async (
      docLineId: string,
      debitAccount: string,
      creditAccount: string,
      amountBase: number,
    ) => {
      await request()
        .post('/api/devtools/test-seed/accounting-entries')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          seedId,
          docLineId,
          postingDate,
          debitAccount,
          creditAccount,
          amount: amountBase,
          amountBase,
          currency: 'RUB',
          brandId: brand.id,
          countryId: country.id,
        })
        .expect(201);
    };

    // Revenue: DR AR_MP / CR Sales 1000
    await seed('pnl:1', '62.01', '90.01', 1000);
    // COGS: DR COGS / CR INV 600
    await seed('pnl:2', '90.03', '10.02', 600);
    // Marketplace fees: DR Fees / CR AR 50
    await seed('pnl:3', '90.04', '62.01', 50);
    // Refunds: DR SalesRevenue / CR AR 100 (contra revenue)
    await seed('pnl:4', '90.01', '62.01', 100);
    // Logistics expenses
    await seed('pnl:5', '90.02.2', '51.01', 30);
    // OPEX (rent)
    await seed('pnl:6', '26.01', '51.01', 200);
  });

  afterAll(async () => {
    delete process.env.ENABLE_TEST_SEED_API;
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('should calculate P&L from accounting entries', async () => {
    const res = await request()
      .get('/api/finance/pnl')
      .set('Authorization', `Bearer ${token}`)
      .query({})
      .expect(200);

    expect(res.body.totalRevenue).toBeCloseTo(1000);
    expect(res.body.totalCogs).toBeCloseTo(600);
    expect(res.body.totalMarketplaceFees).toBeCloseTo(50);
    expect(res.body.totalRefunds).toBeCloseTo(100);
    expect(res.body.totalLogistics).toBeCloseTo(30);
    expect(res.body.totalOpex).toBeCloseTo(200);
    expect(res.body.grossMargin).toBeCloseTo(250);
    expect(res.body.grossMarginPercent).toBeCloseTo(25);
  });
});
