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

describe('TZ 8.4.2 — CashTransfer posting via PostingRun + void (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let country: any;
  let brand: any;
  let walletAcc: any;
  let bankAcc: any;
  let cashflowCategory: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      code: `ZCT-${ts}`,
      name: 'Z-CashTransfer',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-CT-${ts}`,
      name: `LE CashTransfer ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-CT-${ts}`,
      name: `Brand CashTransfer ${ts}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-CT-${ts}`,
      name: 'Cash transfer CF',
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
          name: 'Wallet',
          provider: 'OZON',
          externalRef: `wallet-${ts}`,
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
          name: 'Bank',
          provider: 'Sber',
          externalRef: `bank-${ts}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('post -> entries have postingRunId; void -> reversal; repeated void idempotent', async () => {
    const ref = `CT-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    // Wallet OUT statement line
    const impW = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Wallet',
        importHash: `ct-w-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout out',
          },
        ],
      })
      .expect(200);
    const stW = await request()
      .get(`/api/finance/statements/${impW.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const walletLineId = stW.body.lines[0].id as string;

    // Bank IN statement line
    const impB = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `ct-b-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.IN,
            amount: '1000',
            currency: 'RUB',
            description: 'Payout in',
          },
        ],
      })
      .expect(200);
    const stB = await request()
      .get(`/api/finance/statements/${impB.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const bankLineId = stB.body.lines[0].id as string;

    // Create moneyTx legs and reconcile lines -> MATCHED -> POSTED
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
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `ct:${ref}:wallet`,
          cashflowCategoryId: cashflowCategory.id,
        })
        .expect(201)
    ).body;
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
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `ct:${ref}:bank`,
          cashflowCategoryId: cashflowCategory.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtWallet.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtBank.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Pair transfer
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

    // Post transfer
    const postRes = await request()
      .post(`/api/finance/cash-transfers/${transferId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(postRes.body.transfer.status).toBe('POSTED');
    expect(postRes.body.postingRunId).toBeTruthy();

    const entries = await prisma.accountingEntry.findMany({
      where: {
        docType: 'MARKETPLACE_PAYOUT_TRANSFER' as any,
        docId: transferId,
      } as any,
      orderBy: { lineNumber: 'asc' },
    });
    expect(entries.length).toBe(2);
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

    // Void
    const voidRes = await request()
      .post(`/api/finance/cash-transfers/${transferId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    expect(voidRes.body.reversalRunId).toBeTruthy();

    const reversalEntries = await prisma.accountingEntry.findMany({
      where: { postingRunId: voidRes.body.reversalRunId } as any,
    });
    expect(reversalEntries.length).toBe(2);

    const updatedTxs = await prisma.moneyTransaction.findMany({
      where: { id: { in: [mtWallet.id, mtBank.id] } } as any,
    });
    expect(updatedTxs.every((t) => t.status === 'VOIDED')).toBe(true);

    const tr = await prisma.cashTransfer.findUnique({
      where: { id: transferId },
    });
    expect(tr?.status).toBe('CANCELED');

    // repeated void is idempotent (no new posting runs)
    await request()
      .post(`/api/finance/cash-transfers/${transferId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test void' })
      .expect(200);
    const runs = await (prisma as any).accountingPostingRun.findMany({
      where: {
        legalEntityId: legalEntity.id,
        docType: 'MARKETPLACE_PAYOUT_TRANSFER',
        docId: transferId,
      } as any,
    });
    expect(runs.length).toBe(2); // original + reversal
  }, 120_000);

  it('negative: cannot void if another POSTED statement line is reconciled to a leg moneyTx', async () => {
    const ref = `CT-NEG-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    const impW = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Wallet',
        importHash: `ctn-w-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
            currency: 'RUB',
            description: 'Out',
          },
        ],
      })
      .expect(200);
    const stW = await request()
      .get(`/api/finance/statements/${impW.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const walletLineId = stW.body.lines[0].id as string;

    const impB = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `ctn-b-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.IN,
            amount: '100',
            currency: 'RUB',
            description: 'In',
          },
        ],
      })
      .expect(200);
    const stB = await request()
      .get(`/api/finance/statements/${impB.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const bankLineId = stB.body.lines[0].id as string;

    const mtWallet = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: walletAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.OUT,
          amount: '100',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `ctn:${ref}:wallet`,
          cashflowCategoryId: cashflowCategory.id,
        })
        .expect(201)
    ).body;
    const mtBank = (
      await request()
        .post('/api/finance/money-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: bankAcc.id,
          occurredAt,
          direction: MoneyTransactionDirection.IN,
          amount: '100',
          currency: 'RUB',
          sourceType: MoneyTransactionSourceType.MANUAL,
          idempotencyKey: `ctn:${ref}:bank`,
          cashflowCategoryId: cashflowCategory.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtWallet.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: mtBank.id })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${walletLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${bankLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

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

    await request()
      .post(`/api/finance/cash-transfers/${transferId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const legMoneyTxId = mtWallet.id as string;
    expect(legMoneyTxId).toBeTruthy();

    // Create another statement line and reconcile it to the same moneyTx
    const imp2 = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: walletAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Wallet',
        importHash: `ctn-w2-${Date.now()}`,
        lines: [
          {
            occurredAt,
            direction: MoneyTransactionDirection.OUT,
            amount: '100',
            currency: 'RUB',
            description: 'Duplicate reconcile',
          },
        ],
      })
      .expect(200);
    const st2 = await request()
      .get(`/api/finance/statements/${imp2.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const extraLineId = st2.body.lines[0].id as string;

    await request()
      .post(`/api/finance/statement-lines/${extraLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'MONEY_TRANSACTION', entityId: legMoneyTxId })
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${extraLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request()
      .post(`/api/finance/cash-transfers/${transferId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'should fail' })
      .expect(409);
  }, 120_000);
});
