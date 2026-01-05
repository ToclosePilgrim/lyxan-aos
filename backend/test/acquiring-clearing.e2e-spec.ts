import { INestApplication } from '@nestjs/common';
import {
  AcquiringEventStatus,
  AcquiringEventType,
  AccountingDocType,
  FinancialAccountType,
  MoneyTransactionDirection,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('TZ 5.3 — Acquiring clearing (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let bankAcc: any;

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
      code: 'ZACQ',
      name: 'Z-Acquiring',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-ACQ-${ts}`,
      name: `LE Acquiring ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-ACQ-${ts}`,
      name: `Brand Acquiring ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank account (acquiring)',
          provider: 'TINKOFF',
          externalRef: `bank-acq-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('posts captured/fee/settlement into clearing and clearing closes to zero; idempotent', async () => {
    const provider = 'TINKOFF';
    const t0 = new Date();
    const capturedRef = `cap-${Date.now()}`;
    const feeRef = `fee-${Date.now()}`;
    const settleRef = `set-${Date.now()}`;

    // Import acquiring events
    await request()
      .post('/api/finance/acquiring-events/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        provider,
        events: [
          {
            eventType: AcquiringEventType.PAYMENT_CAPTURED,
            occurredAt: t0.toISOString(),
            amount: '1000',
            currency: 'RUB',
            externalRef: capturedRef,
          },
          {
            eventType: AcquiringEventType.FEE_CHARGED,
            occurredAt: t0.toISOString(),
            amount: '30',
            currency: 'RUB',
            externalRef: feeRef,
          },
          {
            eventType: AcquiringEventType.SETTLEMENT,
            occurredAt: t0.toISOString(),
            amount: '970',
            currency: 'RUB',
            externalRef: settleRef,
          },
        ],
      })
      .expect(200);

    const imported = await prisma.acquiringEvent.findMany({
      where: { legalEntityId: legalEntity.id, provider } as any,
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(imported.length).toBe(3);
    expect(
      imported.every((e) => e.status === AcquiringEventStatus.IMPORTED),
    ).toBe(true);

    // Post all 3
    await request()
      .post('/api/finance/acquiring-events/post')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId: legalEntity.id, provider, limit: 10 })
      .expect(200);

    const entries1 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.ACQUIRING_EVENT,
        legalEntityId: legalEntity.id,
      } as any,
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(entries1.length).toBe(3);

    const codes = {
      CLEARING_ACQUIRING: '57.02',
      CLEARING_ACQUIRING_SALES: '57.03',
      CASH_EQUIVALENTS: '51.00',
      ACQUIRING_FEES_EXPENSE: '90.02.4',
    };

    const hasCaptured = entries1.some(
      (e) =>
        e.debitAccount === codes.CLEARING_ACQUIRING &&
        e.creditAccount === codes.CLEARING_ACQUIRING_SALES &&
        String(e.amount) === '1000',
    );
    const hasFee = entries1.some(
      (e) =>
        e.debitAccount === codes.ACQUIRING_FEES_EXPENSE &&
        e.creditAccount === codes.CLEARING_ACQUIRING &&
        String(e.amount) === '30',
    );
    const hasSettlement = entries1.some(
      (e) =>
        e.debitAccount === codes.CASH_EQUIVALENTS &&
        e.creditAccount === codes.CLEARING_ACQUIRING &&
        String(e.amount) === '970',
    );
    expect(hasCaptured).toBe(true);
    expect(hasFee).toBe(true);
    expect(hasSettlement).toBe(true);

    // Clearing closes: debit - credit == 0
    let clearingNet = 0;
    for (const e of entries1 as any[]) {
      const amt = Number(e.amount);
      if (e.debitAccount === codes.CLEARING_ACQUIRING) clearingNet += amt;
      if (e.creditAccount === codes.CLEARING_ACQUIRING) clearingNet -= amt;
    }
    expect(clearingNet).toBe(0);

    // Post again -> idempotent (still 3 entries)
    await request()
      .post('/api/finance/acquiring-events/post')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId: legalEntity.id, provider, limit: 10 })
      .expect(200);

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.ACQUIRING_EVENT,
        legalEntityId: legalEntity.id,
      } as any,
    });
    expect(entries2.length).toBe(3);

    // Manual link settlement event ↔ bank statement line
    const stmtImp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `acq-settlement-${Date.now()}`,
        lines: [
          {
            occurredAt: t0.toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '970',
            currency: 'RUB',
            description: 'Acquiring settlement',
          },
        ],
      })
      .expect(200);

    const stmt = await request()
      .get(`/api/finance/statements/${stmtImp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const bankLineId = stmt.body.lines[0].id as string;
    const settlementEvent = imported.find(
      (e) => e.eventType === AcquiringEventType.SETTLEMENT,
    )!;

    await request()
      .post(
        `/api/finance/acquiring-events/${settlementEvent.id}/link-statement-line`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ statementLineId: bankLineId })
      .expect(200);

    const linked = await prisma.acquiringEvent.findUnique({
      where: { id: settlementEvent.id },
    });
    expect(linked?.statementLineId).toBe(bankLineId);
  });
});
