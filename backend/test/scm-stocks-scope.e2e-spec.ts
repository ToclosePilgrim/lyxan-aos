import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestApp } from './setup-e2e';

describe('TZ 12 — SCM Stocks legacy alias is scope-isolated (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let createTokenWithLegalEntity: (
    userId: string,
    email: string,
    role: string,
    legalEntityId: string | null,
  ) => Promise<string>;

  const prisma = new PrismaClient();

  let legalEntityA: any;
  let legalEntityB: any;
  let countryA: any;
  let countryB: any;
  let brandA: any;
  let brandB: any;
  let warehouseA: any;
  let warehouseB: any;
  let itemA: any;
  let itemB: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    createTokenWithLegalEntity = testApp.createTokenWithLegalEntity;

    const adminToken = await loginAsAdmin();

    // Create two separate tenants by country->brandCountry->legalEntity mapping (ScopeHelperService uses country)
    countryA = await prisma.country.create({
      data: {
        id: crypto.randomUUID(),
        code: `C-A-${Date.now()}`.slice(0, 10),
        name: 'Country A',
      } as any,
    });
    countryB = await prisma.country.create({
      data: {
        id: crypto.randomUUID(),
        code: `C-B-${Date.now()}`.slice(0, 10),
        name: 'Country B',
      } as any,
    });

    legalEntityA = await prisma.legalEntity.create({
      data: {
        id: crypto.randomUUID(),
        code: `LEA-${Date.now()}-${Math.random()}`.slice(0, 16),
        name: 'Legal Entity A',
        countryCode: countryA.code,
      } as any,
    });
    legalEntityB = await prisma.legalEntity.create({
      data: {
        id: crypto.randomUUID(),
        code: `LEB-${Date.now()}-${Math.random()}`.slice(0, 16),
        name: 'Legal Entity B',
        countryCode: countryB.code,
      } as any,
    });

    // Brands (required by schema relations in some SCM models; also to create BrandCountry mapping)
    brandA = await prisma.brand.create({
      data: {
        id: crypto.randomUUID(),
        code: `BA-${Date.now()}`.slice(0, 10),
        name: 'Brand A',
      } as any,
    });
    brandB = await prisma.brand.create({
      data: {
        id: crypto.randomUUID(),
        code: `BB-${Date.now()}`.slice(0, 10),
        name: 'Brand B',
      } as any,
    });

    await prisma.brandCountry.create({
      data: {
        id: crypto.randomUUID(),
        brandId: brandA.id,
        countryId: countryA.id,
        legalEntityId: legalEntityA.id,
      } as any,
    });
    await prisma.brandCountry.create({
      data: {
        id: crypto.randomUUID(),
        brandId: brandB.id,
        countryId: countryB.id,
        legalEntityId: legalEntityB.id,
      } as any,
    });

    // Warehouses (ScopeHelperService uses warehouse.countryId IN allowedCountryIds)
    warehouseA = await request()
      .post('/api/scm/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `WHA-${Date.now()}`.slice(0, 10),
        name: 'Warehouse A',
        countryId: countryA.id,
        type: 'OWN',
      })
      .expect(201);
    warehouseA = warehouseA.body;

    warehouseB = await request()
      .post('/api/scm/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `WHB-${Date.now()}`.slice(0, 10),
        name: 'Warehouse B',
        countryId: countryB.id,
        type: 'OWN',
      })
      .expect(201);
    warehouseB = warehouseB.body;

    // Items
    itemA = await request()
      .post('/api/mdm/items/ensure')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PRODUCT', name: 'Item A', code: `IA-${Date.now()}`.slice(0, 10), unit: 'pcs' })
      .expect(201);
    itemA = itemA.body;

    itemB = await request()
      .post('/api/mdm/items/ensure')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PRODUCT', name: 'Item B', code: `IB-${Date.now()}`.slice(0, 10), unit: 'pcs' })
      .expect(201);
    itemB = itemB.body;

    // Seed balances directly (read-model); one item per tenant
    await prisma.inventoryBalance.upsert({
      where: {
        warehouseId_itemId: {
          warehouseId: warehouseA.id,
          itemId: itemA.id,
        },
      } as any,
      update: { quantity: '10' } as any,
      create: {
        warehouseId: warehouseA.id,
        itemId: itemA.id,
        quantity: '10',
      } as any,
    });

    await prisma.inventoryBalance.upsert({
      where: {
        warehouseId_itemId: {
          warehouseId: warehouseB.id,
          itemId: itemB.id,
        },
      } as any,
      update: { quantity: '20' } as any,
      create: {
        warehouseId: warehouseB.id,
        itemId: itemB.id,
        quantity: '20',
      } as any,
    });

    // Create users (Manager role) and JWT with legalEntityId in payload.
    const role = await prisma.role.findFirst({ where: { name: 'Manager' } });
    if (!role) throw new Error('Manager role not found');

    userA = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `stocks-user-a-${Date.now()}@test.com`,
        password: await bcrypt.hash('password', 10),
        roleId: role.id,
      } as any,
    });
    userB = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `stocks-user-b-${Date.now()}@test.com`,
        password: await bcrypt.hash('password', 10),
        roleId: role.id,
      } as any,
    });

    tokenA = await createTokenWithLegalEntity(
      userA.id,
      userA.email,
      'Manager',
      legalEntityA.id,
    );
    tokenB = await createTokenWithLegalEntity(
      userB.id,
      userB.email,
      'Manager',
      legalEntityB.id,
    );
  });

  afterAll(async () => {
    if (app) if (app) await app.close();
    await prisma.$disconnect();
  });

  it('userA sees only tenant A stock rows (no warehouseId filter)', async () => {
    const res = await request()
      .get('/api/scm/stocks')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((r: any) => r.id);
    expect(ids).toContain(itemA.id);
    expect(ids).not.toContain(itemB.id);
  });

  it('userB sees only tenant B stock rows (no warehouseId filter)', async () => {
    const res = await request()
      .get('/api/scm/stocks')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((r: any) => r.id);
    expect(ids).toContain(itemB.id);
    expect(ids).not.toContain(itemA.id);
  });

  it('userA cannot query tenant B warehouse explicitly', async () => {
    await request()
      .get('/api/scm/stocks')
      .query({ warehouseId: warehouseB.id })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });
});



