import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinanceCapitalizationPolicy,
  FinancialAccountType,
  FinancialDocumentDirection,
  FinancialDocumentType,
  PaymentRequestType,
  Prisma,
  PrismaClient,
  RecurringJournalType,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
  seedPnlCategory,
} from './api-seed';

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
function nextMonthStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

describe('TZ 6.3 — Recurring Journals (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let supplier: any;
  let bankAccount: any;
  let approvalPolicy: any;
  let cashflowCategory: any;
  let pnlCategory: any;

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
      code: `ZRJ-${ts}`,
      name: 'Z-Recurring',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-RJ-${ts}`,
      name: `LE Recurring ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-RJ-${ts}`,
      name: `Brand RJ ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier ${ts}`,
          code: `SUP-RJ-${ts}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-RJ-${ts}`,
      name: 'Ops',
      isTransfer: false,
    });
    pnlCategory = await seedPnlCategory({
      request,
      token,
      code: `PNL-RJ-${ts}`,
      name: 'OPEX',
    });

    approvalPolicy = await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.RENT,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });

    bankAccount = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank RUB',
          provider: 'Sber',
          externalRef: `acc-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('PREPAID: accrue auto-creates journal; run creates 3 recognition entries; re-run has no duplicates', async () => {
    const now = new Date();
    const m0 = monthStart(now);
    const m1 = nextMonthStart(m0);
    const m2 = nextMonthStart(m1);
    const m3 = nextMonthStart(m2);

    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.RENT,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 3000,
          supplierId: supplier.id,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.PREPAID_EXPENSE,
          recognizedFrom: m0.toISOString(),
          recognizedTo: new Date(m3.getTime() - 1).toISOString(), // end of 3rd month
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const journal = await prisma.recurringJournal.findFirst({
      where: {
        sourceDocumentId: doc.id,
        journalType: RecurringJournalType.PREPAID_RECOGNITION,
      } as any,
    });
    expect(journal).toBeTruthy();

    const run1 = await request()
      .post('/api/finance/recurring-journals/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        from: m0.toISOString(),
        to: new Date(m3.getTime() - 1).toISOString(),
        journalType: RecurringJournalType.PREPAID_RECOGNITION,
      })
      .expect(200);
    expect(run1.body.resultsCount).toBeGreaterThan(0);

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
        docId: doc.id,
      } as any,
      orderBy: [{ postingDate: 'asc' }],
    });
    expect(entries.length).toBe(3);
    expect(entries[0].creditAccount).toBe('97.01'); // PREPAID_EXPENSE_ASSET

    // idempotency: re-run should not create new entries
    await request()
      .post('/api/finance/recurring-journals/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        from: m0.toISOString(),
        to: new Date(m3.getTime() - 1).toISOString(),
        journalType: RecurringJournalType.PREPAID_RECOGNITION,
      })
      .expect(200);

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
        docId: doc.id,
      } as any,
    });
    expect(entries2.length).toBe(3);
  });

  it('ASSET: accrue auto-creates depreciation journal; run creates 2 entries; re-run has no duplicates', async () => {
    const now = new Date();
    const from = monthStart(now);
    const to = nextMonthStart(from); // includes 2 months: from-month and next-month

    const doc = (
      await request()
        .post('/api/finance/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialDocumentType.OTHER,
          direction: FinancialDocumentDirection.OUT,
          currency: 'RUB',
          amountTotal: 2000,
          supplierId: supplier.id,
          cashflowCategoryId: cashflowCategory.id,
          pnlCategoryId: pnlCategory.id,
          capitalizationPolicy: FinanceCapitalizationPolicy.FIXED_ASSET,
          usefulLifeMonths: 2,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${doc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const journal = await prisma.recurringJournal.findFirst({
      where: {
        sourceDocumentId: doc.id,
        journalType: RecurringJournalType.DEPRECIATION,
      } as any,
    });
    expect(journal).toBeTruthy();

    await request()
      .post('/api/finance/recurring-journals/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        from: from.toISOString(),
        to: to.toISOString(),
        journalType: RecurringJournalType.DEPRECIATION,
      })
      .expect(200);

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
        docId: doc.id,
      } as any,
    });
    expect(entries.length).toBe(2);

    await request()
      .post('/api/finance/recurring-journals/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        from: from.toISOString(),
        to: to.toISOString(),
        journalType: RecurringJournalType.DEPRECIATION,
      })
      .expect(200);

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
        docId: doc.id,
      } as any,
    });
    expect(entries2.length).toBe(2);
  });
});
