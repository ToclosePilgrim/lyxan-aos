import { CounterpartyRole } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedWarehouse } from './api-seed';

describe('TZ 8.3.B.1 — SCM wiring smoke (e2e)', () => {
  it('GET /api/scm/products is not 404; POST /api/scm/supplies validates supplierCounterpartyId role', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    // wiring check: should be alive and not error (empty list is fine)
    await request()
      .get('/api/scm/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Setup minimal warehouse via public APIs
    const country = await seedCountry({
      request,
      token,
      code: `TL-${Date.now()}`,
      name: 'Testland',
    });
    const warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-${Date.now()}`,
      name: 'E2E Warehouse',
      type: 'OWN',
      countryId: country.id,
    });

    const supplierCp = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Supplier CP', roles: [CounterpartyRole.SUPPLIER] })
        .expect(201)
    ).body;

    const nonSupplierCp = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Service Provider',
          roles: [CounterpartyRole.SERVICE_PROVIDER],
        })
        .expect(201)
    ).body;

    // Negative: wrong role
    await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierCounterpartyId: nonSupplierCp.id,
        warehouseId: warehouse.id,
        currency: 'RUB',
      })
      .expect(422);

    // Happy path
    await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierCounterpartyId: supplierCp.id,
        warehouseId: warehouse.id,
        currency: 'RUB',
      })
      .expect(201);

    if (app) await app.close();
  });
});
