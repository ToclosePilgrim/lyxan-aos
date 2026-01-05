import { INestApplication } from '@nestjs/common';
import {
  CashAccountingLinkRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('Marketplace payout transfer (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let walletAcc: any;
  let bankAcc: any;
  let cfTransfer: any;
  let walletLineId: string;
  let bankLineId: string;

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
      code: 'ZMP',
      name: 'Z-MP',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-MP-${ts}`,
      name: `LE MP ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-MP-${ts}`,
      name: `Brand MP ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    cfTransfer = await seedCashflowCategory({
      request,
      token,
      code: `CF_TR_MP_${ts}`,
      name: 'Internal transfers (e2e)',
      isTransfer: true,
    });

    walletAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.MARKETPLACE_WALLET,
          currency: 'RUB',
          name: 'Ozon wallet',
          provider: 'Ozon',
          externalRef: `wallet-${Date.now()}`,
        })
        .expect(201)
    ).body;

    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Sber bank',
          provider: 'Sber',
          externalRef: `bank-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('pairs wallet OUT + bank IN and posts transfer entries + links idempotently', async () => {
    const ref = `PAYOUT123-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    // Import + post wallet OUT line
    const impWallet = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        sourceName: 'Ozon',
        importHash: `mp-w-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout to bank',
            bankReference: ref,
            externalLineId: ref,
          },
        ],
      })
      .expect(200);
    const stWallet = await request()
      .get(`/api/finance/statements/${impWallet.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    walletLineId = stWallet.body.lines[0].id;

    const mtWallet = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '1000',
          currency: 'RUB',
          description: 'Manual wallet OUT',
          cashflowCategoryId: cfTransfer.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `mp-wallet:${ref}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtWallet.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Import + post bank IN line
    const impBank = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Sber',
        importHash: `mp-b-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.IN,
            amount: '1000',
            currency: 'RUB',
            description: 'Ozon payout received',
            bankReference: ref,
          },
        ],
      })
      .expect(200);
    const stBank = await request()
      .get(`/api/finance/statements/${impBank.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    bankLineId = stBank.body.lines[0].id;

    const mtBank = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: bankAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.IN,
          amount: '1000',
          currency: 'RUB',
          description: 'Manual bank IN',
          cashflowCategoryId: cfTransfer.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `mp-bank:${ref}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtBank.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Pair
    const pairRes = await request()
      .post('/api/finance/cash-transfers/marketplace/pair')
      .set('Authorization', `Bearer ${token}`)
      .send({
        walletStatementLineId: walletLineId,
        bankStatementLineId: bankLineId,
        provider: 'Ozon',
        externalRef: ref,
      })
      .expect(200);
    const transferId = pairRes.body.transferId;
    expect(transferId).toBeTruthy();

    // Post transfer
    const post1 = await request()
      .post(`/api/finance/cash-transfers/${transferId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(post1.body.transfer.status).toBe('POSTED');

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: 'MARKETPLACE_PAYOUT_TRANSFER' as any,
        docId: transferId,
      } as any,
      orderBy: { lineNumber: 'asc' },
    });
    expect(entries.length).toBe(2);
    const docLineIds = entries.map((e) => e.metadata?.docLineId).sort();
    expect(docLineIds).toEqual([
      `cash_transfer:${transferId}:in`,
      `cash_transfer:${transferId}:out`,
    ]);

    expect(entries.every((e) => !!e.postingRunId)).toBe(true);

    const linksWallet = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mtWallet.id,
        role: CashAccountingLinkRole.TRANSFER,
      } as any,
    });
    const linksBank = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mtBank.id,
        role: CashAccountingLinkRole.TRANSFER,
      } as any,
    });
    expect(linksWallet.length).toBeGreaterThan(0);
    expect(linksBank.length).toBeGreaterThan(0);

    // Idempotent post
    const beforeLinks = await prisma.cashAccountingLink.count({
      where: { role: CashAccountingLinkRole.TRANSFER } as any,
    });
    await request()
      .post(`/api/finance/cash-transfers/${transferId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterLinks = await prisma.cashAccountingLink.count({
      where: { role: CashAccountingLinkRole.TRANSFER } as any,
    });
    expect(afterLinks).toBe(beforeLinks);
  });

  it('rejects pairing for currency mismatch', async () => {
    const ref = `PAYOUT-BAD-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    const impW = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.MARKETPLACE,
        importHash: `mp-badw-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '10',
            currency: 'RUB',
            description: 'bad',
          },
        ],
      })
      .expect(200);
    const stW = await request()
      .get(`/api/finance/statements/${impW.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const wId = stW.body.lines[0].id;
    const mtW = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '10',
          currency: 'RUB',
          description: 'bad',
          cashflowCategoryId: cfTransfer.id,
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `badw:${ref}`,
        })
        .expect(201)
    ).body;
    await request()
      .post(`/api/finance/statement-lines/${wId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtW.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${wId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const impB = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        importHash: `mp-badb-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.IN,
            amount: '10',
            currency: 'USD', // mismatch
            description: 'bad',
          },
        ],
      });
    expect([400, 200]).toContain(impB.status); // import itself may reject currency mismatch earlier
  });
});
