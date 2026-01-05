import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  PaymentRequestType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedMarketplace,
  seedMdmItem,
} from './api-seed';

describe('Finance Sales Documents (API-only e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let marketplace: any;
  let item: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      code: `ZSD-${ts}`,
      name: 'Z-SalesDocs',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SD-${ts}`,
      name: `LE SalesDocs ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-SD-${ts}`,
      name: `Brand SalesDocs ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    // SalesDocuments posting creates AccountingEntry with posting-runs; policy must exist in some flows
    await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.RENT,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });

    marketplace = await seedMarketplace({
      request,
      token,
      code: 'OZON',
      name: 'Ozon',
    });
    item = await seedMdmItem({
      request,
      token,
      type: 'PRODUCT',
      name: `SalesDoc Item ${ts}`,
      code: `SD-ITEM-${ts}`,
      unit: 'pcs',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates SalesDocument via API and posts marketplace fee entries idempotently', async () => {
    const occurredAt = new Date().toISOString();
    const orderId = `ORD-${Date.now()}`;
    const feeCode = 'COMMISSION';

    const created = (
      await request()
        .post('/api/finance/sales-documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId: brand.id,
          countryId: country.id,
          marketplaceId: marketplace.id,
          sourceType: 'E2E',
          externalId: `sd:${orderId}`,
          periodFrom: occurredAt,
          periodTo: occurredAt,
          status: 'IMPORTED',
          lines: [
            {
              itemId: item.id,
              date: occurredAt,
              quantity: '1',
              revenue: '0',
              commission: '100',
              refunds: '0',
              cogsAmount: '0',
              meta: { marketplace: { orderId, operationId: null, feeCode } },
            },
          ],
        })
        .expect(201)
    ).body;

    await request()
      .patch(`/api/finance/sales-documents/${created.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const entries1 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: created.id,
      } as any,
    });
    expect(entries1.length).toBeGreaterThan(0);

    // idempotent post
    await request()
      .patch(`/api/finance/sales-documents/${created.id}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: created.id,
      } as any,
    });
    expect(entries2.length).toBe(entries1.length);
  });
});

