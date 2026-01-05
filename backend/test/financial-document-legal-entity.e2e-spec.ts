import { INestApplication } from '@nestjs/common';
import { CounterpartyRole, FinanceCapitalizationPolicy } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedPnlCategory,
  seedWarehouse,
} from './api-seed';

describe('FinancialDocument legalEntityId resolution (API-only e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;

  let legalEntityId: string;
  let brandId: string;
  let warehouseId: string;
  let supplierId: string;
  let supplyId: string;
  let pnlCategoryId: string;
  let cashflowCategoryId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `TC-${ts}`,
      name: `Test Country ${ts}`,
    });
    const legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-${ts}`,
      name: `Test LE ${ts}`,
      countryCode: country.code,
    });
    legalEntityId = legalEntity.id;

    const brand = await seedBrand({
      request,
      token,
      code: `TB-${ts}`,
      name: `Test Brand ${ts}`,
    });
    brandId = brand.id;

    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    const warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-${ts}`,
      name: `Test WH ${ts}`,
      countryId: country.id,
      type: 'OWN',
    });
    warehouseId = warehouse.id;

    const supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Test Supplier ${ts}`,
          code: `SUP-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;
    supplierId = supplier.id;

    const item = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-${ts}`,
      name: 'Material',
      unit: 'pcs',
    });

    // Create supply and one line so /from-supply can resolve doc linkage
    const supply = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplierId,
          warehouseId,
          brandId,
          currency: 'RUB',
        })
        .expect(201)
    ).body;
    supplyId = supply.id;

    await request()
      .post(`/api/scm/supplies/${supplyId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SERVICE',
        itemId: item.id,
        unit: 'pcs',
        quantityOrdered: 10,
        pricePerUnit: 5,
        currency: 'RUB',
      })
      .expect(201);

    const pnl = await seedPnlCategory({
      request,
      token,
      code: `PNL-${ts}`,
      name: 'Test PnL Category',
    });
    pnlCategoryId = pnl.id;

    const cf = await seedCashflowCategory({
      request,
      token,
      code: `CF-${ts}`,
      name: 'Test Cashflow Category',
      isTransfer: false,
    });
    cashflowCategoryId = cf.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates FinancialDocument from supply with resolved legalEntityId + categories + prepaid policy', async () => {
    const res = await request()
      .post(`/api/finance/documents/from-supply/${supplyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        currency: 'RUB',
        type: 'SUPPLY_INVOICE',
        pnlCategoryId,
        cashflowCategoryId,
        capitalizationPolicy: FinanceCapitalizationPolicy.PREPAID_EXPENSE,
        recognizedFrom: '2025-01-01T00:00:00.000Z',
        recognizedTo: '2025-12-31T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.legalEntityId).toBe(legalEntityId);
    expect(res.body.pnlCategoryId).toBe(pnlCategoryId);
    expect(res.body.cashflowCategoryId).toBe(cashflowCategoryId);
    expect(res.body.capitalizationPolicy).toBe('PREPAID_EXPENSE');
    expect(res.body.recognizedFrom).toBeDefined();
    expect(res.body.recognizedTo).toBeDefined();
  });

  it('rejects FinancialDocument create without legalEntityId and without resolvable link', async () => {
    await request()
      .post('/api/finance/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currency: 'RUB',
        supplierId,
        amountTotal: 100,
      })
      .expect(422);
  });
});

