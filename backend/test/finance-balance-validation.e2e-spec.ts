import { INestApplication } from '@nestjs/common';
import { AccountingDocType, PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
} from './api-seed';

describe('TZ 7 — Finance balance validation ALWAYS ON (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  const prisma = new PrismaClient();

  afterAll(async () => {
    if (app) if (app) await app.close();
    await prisma.$disconnect();
  });

  it('blocks posting when existing postingRun has unbalanced entry (422) and does not mark document POSTED', async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;

    const adminToken = await loginAsAdmin();

    const country = await seedCountry({
      request,
      token: adminToken,
      code: `TZ7-${Date.now()}`,
      name: `TZ7 Country ${Date.now()}`,
    });
    const le = await seedLegalEntity({
      request,
      token: adminToken,
      code: `TZ7LE-${Date.now()}`,
      name: `TZ7 LegalEntity ${Date.now()}`,
      countryCode: country.code,
    });
    const brand = await seedBrand({
      request,
      token: adminToken,
      code: `TZ7B-${Date.now()}`,
      name: `TZ7 Brand ${Date.now()}`,
    });
    await seedBrandCountry({
      request,
      token: adminToken,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: le.id,
    });

    const item = await seedMdmItem({
      request,
      token: adminToken,
      type: 'PRODUCT',
      name: `TZ7 Item ${Date.now()}`,
      code: `TZ7ITEM-${Date.now()}`,
      unit: 'pcs',
    });

    // Create SalesDocument via API
    const sdRes = await request()
      .post('/api/finance/sales-documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brandId: brand.id,
        countryId: country.id,
        sourceType: 'TZ7_TEST',
        externalId: `tz7-${Date.now()}`,
        periodFrom: new Date().toISOString(),
        periodTo: new Date().toISOString(),
        status: 'DRAFT',
        lines: [
          {
            itemId: item.id,
            date: new Date().toISOString(),
            quantity: '1',
            revenue: '100.00',
            commission: '10.00',
            refunds: '0',
            cogsAmount: '0',
            meta: {},
          },
        ],
      })
      .expect(201);

    const salesDocId = sdRes.body.id;

    // Create PostingRun and inject a malformed AccountingEntry to simulate a bug/partial write
    const run = await prisma.accountingPostingRun.create({
      data: {
        id: crypto.randomUUID(),
        legalEntityId: le.id,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: salesDocId,
        version: 1,
        status: 'POSTED' as any,
        postedAt: new Date(),
      } as any,
    });

    await prisma.accountingEntry.create({
      data: {
        id: crypto.randomUUID(),
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: salesDocId,
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount: '', // invalid -> makes debit sum != credit sum
        creditAccount: '90.01',
        amount: '1.00',
        currency: 'RUB',
        amountBase: '1.00',
        brandId: brand.id,
        countryId: country.id,
        legalEntityId: le.id,
        postingRunId: run.id,
        source: 'test',
      } as any,
    });

    // Now post: service sees "hasEntries" and runs validation -> should throw 422 and not update SalesDocument.status
    await request()
      .post(`/api/finance/sales-documents/${salesDocId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(422);

    const docAfter = await prisma.salesDocument.findUnique({
      where: { id: salesDocId },
      select: { status: true },
    });
    expect(docAfter?.status).toBe('DRAFT');
  }, 120_000);
});



