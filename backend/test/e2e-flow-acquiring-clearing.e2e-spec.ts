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

describe('TZ 8.2 Flow D — Acquiring clearing + settlement reconcile (e2e)', () => {
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
      code: 'ZFD',
      name: 'Z-Flow-D',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-FD-${ts}`,
      name: `LE Flow D ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-FD-${ts}`,
      name: `Brand Flow D ${ts}`,
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
          name: 'Bank FD',
          provider: 'TINKOFF',
          externalRef: `bank-fd-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('posts captured/fee/settlement into clearing, links settlement to statement line, explain shows AcquiringEvent + StatementLine', async () => {
    const provider = 'TINKOFF';
    const t0 = new Date();
    const capturedRef = `cap-${Date.now()}`;
    const feeRef = `fee-${Date.now()}`;
    const settleRef = `set-${Date.now()}`;

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
      orderBy: { createdAt: 'asc' } as any,
    });
    expect(imported.length).toBe(3);
    expect(
      imported.every((e) => e.status === AcquiringEventStatus.IMPORTED),
    ).toBe(true);

    await request()
      .post('/api/finance/acquiring-events/post')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId: legalEntity.id, provider, limit: 10 })
      .expect(200);

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.ACQUIRING_EVENT,
        legalEntityId: legalEntity.id,
      } as any,
    });
    expect(entries.length).toBe(3);

    // Clearing closes to zero: (debit - credit on 57.02) == 0
    let clearingNet = 0;
    for (const e of entries as any[]) {
      const amt = Number(e.amount);
      if (e.debitAccount === '57.02') clearingNet += amt;
      if (e.creditAccount === '57.02') clearingNet -= amt;
    }
    expect(clearingNet).toBe(0);

    const links = await prisma.acquiringAccountingLink.findMany({
      where: { acquiringEventId: { in: imported.map((x) => x.id) } } as any,
    });
    expect(links.length).toBeGreaterThan(0);

    // Import bank statement IN line for settlement and link to settlement event
    const stmtImp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `fd-${Date.now()}`,
        lines: [
          {
            occurredAt: t0.toISOString(),
            direction: MoneyTransactionDirection.IN,
            amount: '970',
            currency: 'RUB',
            description: 'Acq settlement',
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

    // Explain BS for clearing 57.02 includes AcquiringEvent + StatementLine
    const at = t0.toISOString().slice(0, 10);
    const exp = await request()
      .get(
        `/api/finance/reports/explain/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}&accountId=57.02&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const primaryTypes = new Set(
      exp.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('AcquiringEvent')).toBe(true);
    expect(primaryTypes.has('StatementLine')).toBe(true);

    // Reports smoke
    await request()
      .get(
        `/api/finance/reports/balance-sheet?legalEntityId=${legalEntity.id}&at=${at}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
