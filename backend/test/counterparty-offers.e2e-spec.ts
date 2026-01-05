import { INestApplication } from '@nestjs/common';
import { CounterpartyRole, PrismaClient } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity, seedMdmItem } from './api-seed';

describe('TZ 8.3.B.1 — CounterpartyOffers API smoke (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let counterparty: any;
  let item: any;
  let offer1: any;
  let offer2: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZFO-${ts}`,
      name: 'Z-Offers',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-OFF-${ts}`,
      name: `LE Offers ${ts}`,
      countryCode: country.code,
    });

    counterparty = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier Offers ${Date.now()}`,
          code: `SUP-OFF-${Date.now()}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    item = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      name: 'Material Offers',
      code: `MAT-OFF-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('create (with mdmItemId) + idempotency by externalRef + list/search + archive + create (auto item)', async () => {
    // create offer with mdmItemId
    offer1 = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: counterparty.id,
          mdmItemId: item.id,
          offerType: 'MATERIAL',
          currency: 'RUB',
          price: 10,
          externalRef: `EXT-${Date.now()}`,
          sku: `SKU-${Date.now()}`,
        })
        .expect(201)
    ).body;

    expect(offer1.id).toBeDefined();
    expect(offer1.legalEntityId).toBe(legalEntity.id);
    expect(offer1.counterpartyId).toBe(counterparty.id);
    expect(offer1.mdmItemId).toBe(item.id);

    // idempotency: same externalRef should return same offer id
    const offer1Repeat = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: counterparty.id,
          mdmItemId: item.id,
          offerType: 'MATERIAL',
          currency: 'RUB',
          price: 11,
          externalRef: offer1.externalRef,
        })
        .expect(201)
    ).body;
    expect(offer1Repeat.id).toBe(offer1.id);
    expect(offer1Repeat.price).toBe(11);

    // list + q search by externalRef
    const list = (
      await request()
        .get(
          `/api/mdm/counterparty-offers?legalEntityId=${legalEntity.id}&q=${encodeURIComponent(
            offer1.externalRef,
          )}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    expect(Array.isArray(list)).toBe(true);
    expect(list.find((o: any) => o.id === offer1.id)).toBeDefined();

    // archive
    const archived = (
      await request()
        .post(
          `/api/mdm/counterparty-offers/${offer1.id}/archive?legalEntityId=${legalEntity.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    expect(archived.status).toBe('ARCHIVED');

    // create offer without mdmItemId -> auto-create item
    offer2 = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: counterparty.id,
          itemType: 'MATERIAL',
          itemName: `Auto Material ${Date.now()}`,
          itemSku: `AUTO-MAT-${Date.now()}`,
          currency: 'RUB',
          price: 5,
          externalRef: `EXT-AUTO-${Date.now()}`,
        })
        .expect(201)
    ).body;
    expect(offer2.mdmItemId).toBeDefined();

    const createdItem = await prisma.mdmItem.findUnique({
      where: { id: offer2.mdmItemId } as any,
    });
    expect(createdItem?.id).toBe(offer2.mdmItemId);
    expect(createdItem?.type).toBe('MATERIAL');

    // includeArchived=false should hide offer1
    const activeOnly = (
      await request()
        .get(`/api/mdm/counterparty-offers?legalEntityId=${legalEntity.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    expect(activeOnly.find((o: any) => o.id === offer1.id)).toBeUndefined();

    // includeArchived=true should include it
    const withArchived = (
      await request()
        .get(
          `/api/mdm/counterparty-offers?legalEntityId=${legalEntity.id}&includeArchived=true`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    expect(withArchived.find((o: any) => o.id === offer1.id)).toBeDefined();
  }, 120_000);
});
