import { INestApplication } from '@nestjs/common';
import { CounterpartyRole, PrismaClient } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import { seedCountry, seedLegalEntity, seedMdmItem } from './api-seed';

describe('TZ 8.3.B.1B — CounterpartyOffers SERVICE creates SERVICE item (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let counterparty: any;
  let productItem: any;
  let serviceOffer: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZSV-${ts}`,
      name: 'Z-Service',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SVC-${ts}`,
      name: `LE Service ${ts}`,
      countryCode: country.code,
    });

    counterparty = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `CP Service ${Date.now()}`,
          code: `CP-SVC-${Date.now()}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    productItem = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      name: 'Product Item',
      code: `PRD-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('SERVICE offer without mdmItemId auto-creates MdmItemType.SERVICE', async () => {
    serviceOffer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: counterparty.id,
          offerType: 'SERVICE',
          itemType: 'SERVICE',
          itemName: 'Cleaning',
          itemSku: `SVC-${Date.now()}`,
          currency: 'RUB',
          price: 100,
          externalRef: `SVC-OFFER-${Date.now()}`,
        })
        .expect(201)
    ).body;

    expect(serviceOffer.offerType).toBe('SERVICE');
    expect(serviceOffer.mdmItemId).toBeDefined();

    const item = await prisma.mdmItem.findUnique({
      where: { id: serviceOffer.mdmItemId } as any,
    });
    expect(item?.type).toBe('SERVICE');
  });

  it('negative: SERVICE offer cannot link to non-SERVICE item', async () => {
    await request()
      .post('/api/mdm/counterparty-offers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        counterpartyId: counterparty.id,
        offerType: 'SERVICE',
        mdmItemId: productItem.id,
        currency: 'RUB',
        price: 10,
        externalRef: `SVC-BAD-${Date.now()}`,
      })
      .expect(422);
  });
});
