import { CounterpartyRole } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedWarehouse } from './api-seed';

describe('Architecture Boundary: SCM supply requires Counterparty(role=SUPPLIER)', () => {
  it('Supply create requires supplierCounterpartyId and SUPPLIER role', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `TL-${ts}`,
      name: 'Testland',
    });
    const warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-${ts}`,
      name: 'E2E Warehouse',
      countryId: country.id,
      type: 'OWN',
    });

    // Create SUPPLIER counterparty via MDM API (the point of this test).
    const supplierCp = await request()
      .post('/api/mdm/counterparties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Supplier Counterparty',
        roles: [CounterpartyRole.SUPPLIER],
      })
      .expect(201);

    // Missing supplierCounterpartyId -> 400/422
    await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: warehouse.id,
        currency: 'RUB',
      })
      .expect((r) => {
        if (![400, 422].includes(r.status)) {
          throw new Error(`Expected 400/422, got ${r.status}`);
        }
      });

    // Counterparty without SUPPLIER role -> 422
    const nonSupplierCp = await request()
      .post('/api/mdm/counterparties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Service Provider',
        roles: [CounterpartyRole.SERVICE_PROVIDER],
      })
      .expect(201);

    await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierCounterpartyId: nonSupplierCp.body.id,
        warehouseId: warehouse.id,
        currency: 'RUB',
      })
      .expect(422);

    // Happy path: SUPPLIER role -> 201
    await request()
      .post('/api/scm/supplies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierCounterpartyId: supplierCp.body.id,
        warehouseId: warehouse.id,
        currency: 'RUB',
      })
      .expect(201);

    if (app) await app.close();
  });
});
