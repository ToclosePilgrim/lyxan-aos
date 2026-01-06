import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PrismaClient,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('CashAccountingLink + internal transfer posting (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let brand: any;

  let acc1: any;
  let acc2: any;
  let outTx: any;
  let inTx: any;
  let transferGroupId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    const ts = Date.now();
    const country = await seedCountry({
      request,
      token,
      code: `ZI-${ts}`,
      name: 'Z-Internal',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-IT-${ts}`,
      name: `LE Internal Transfer ${ts}`,
      countryCode: country.code,
    });

    // Needed for AccountingEntry scope resolver: map legalEntityId -> (brandId,countryId)
    brand = await seedBrand({
      request,
      token,
      code: `BR-IT-${ts}`,
      name: `Brand IT ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    // Create two accounts
    acc1 = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank 1',
          provider: 'Sber',
          externalRef: `acc1-${ts}`,
        })
        .expect(201)
    ).body;

    acc2 = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank 2',
          provider: 'Sber',
          externalRef: `acc2-${ts}`,
        })
        .expect(201)
    ).body;

    transferGroupId = crypto.randomUUID();
    const occurredAt = new Date().toISOString();

    outTx = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: acc1.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '100',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
          sourceId: transferGroupId,
          idempotencyKey: `${transferGroupId}:out`,
        })
        .expect(201)
    ).body;

    inTx = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: acc2.id,
          occurredAt,
          direction: MoneyTransactionDirection.IN,
          amount: '100',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
          sourceId: transferGroupId,
          idempotencyKey: `${transferGroupId}:in`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('posts internal transfer and creates 2 links; repeat is idempotent', async () => {
    const res1 = await request()
      .post('/api/finance/internal-transfers/post')
      .set('Authorization', `Bearer ${token}`)
      .send({
        outMoneyTransactionId: outTx.id,
        inMoneyTransactionId: inTx.id,
      })
      .expect(200);

    expect(res1.body.transferGroupId).toBe(transferGroupId);
    expect(Array.isArray(res1.body.accountingEntryIds)).toBe(true);
    expect(res1.body.accountingEntryIds.length).toBe(2);

    // Ensure entries exist with correct docType/docId
    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: transferGroupId,
      },
      orderBy: { lineNumber: 'asc' },
    });
    expect(entries.length).toBe(2);

    // Links (one per moneyTx)
    const links = await prisma.cashAccountingLink.findMany({
      where: { role: CashAccountingLinkRole.TRANSFER },
    });
    const linkTxIds = new Set(links.map((l) => l.moneyTransactionId));
    expect(linkTxIds.has(outTx.id)).toBe(true);
    expect(linkTxIds.has(inTx.id)).toBe(true);

    // Repeat - should not create extra rows
    await request()
      .post('/api/finance/internal-transfers/post')
      .set('Authorization', `Bearer ${token}`)
      .send({
        outMoneyTransactionId: outTx.id,
        inMoneyTransactionId: inTx.id,
      })
      .expect(200);

    const entries2 = await prisma.accountingEntry.findMany({
      where: {
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: transferGroupId,
      },
    });
    expect(entries2.length).toBe(2);

    const links2 = await prisma.cashAccountingLink.findMany({
      where: { role: CashAccountingLinkRole.TRANSFER },
    });
    // exactly 2 (out + in)
    const byTx = new Map<string, number>();
    for (const l of links2)
      byTx.set(l.moneyTransactionId, (byTx.get(l.moneyTransactionId) ?? 0) + 1);
    expect(byTx.get(outTx.id)).toBe(1);
    expect(byTx.get(inTx.id)).toBe(1);
  });
});




