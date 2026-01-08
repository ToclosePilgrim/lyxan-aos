import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  PaymentRequestType,
  PrismaClient,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedBrand,
  seedBrandCountry,
  seedCashflowCategory,
  seedCategoryDefaultMapping,
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedPnlCategory,
  seedWarehouse,
} from './api-seed';

describe('TZ 8.2 Flow A — Supply receipt → AP → payment → bank statement reconcile (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
  let supplier: any;
  let item: any;
  let offer: any;

  let bankAcc: any;
  let cashflowCategory: any;
  let pnlCategory: any;
  let policy: any;

  let supplyId: string;
  let receiptId: string;
  let paymentExecutionId: string;
  let statementLineId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    loginAsAdmin = testApp.loginAsAdmin;
    token = await loginAsAdmin();

    country = await seedCountry({
      request,
      token,
      code: 'ZFA',
      name: 'Z-Flow-A',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-FA-${Date.now()}`,
      name: `LE Flow A ${Date.now()}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-FA-${Date.now()}`,
      name: `Brand Flow A ${Date.now()}`,
    });
    await seedBrandCountry({
      request,
      token,
      brandId: brand.id,
      countryId: country.id,
      legalEntityId: legalEntity.id,
    });
    warehouse = await seedWarehouse({
      request,
      token,
      code: `WH-FA-${Date.now()}`,
      name: `WH Flow A ${Date.now()}`,
      type: 'OWN',
      countryId: country.id,
    });

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier FA ${Date.now()}`,
          code: `SUP-FA-${Date.now()}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    item = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-FA-${Date.now()}`,
      name: 'Material FA',
      unit: 'pcs',
    });

    offer = (
      await request()
        .post('/api/mdm/counterparty-offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          counterpartyId: supplier.id,
          mdmItemId: item.id,
          offerType: 'MATERIAL',
          sku: `VSKU-FA-${Date.now()}`,
          currency: 'RUB',
          price: 10,
          externalRef: `FA-OFFER-${Date.now()}`,
        })
        .expect(201)
    ).body;

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-FA-${Date.now()}`,
      name: 'Ops',
    });
    pnlCategory = await seedPnlCategory({
      request,
      token,
      code: `PNL-FA-${Date.now()}`,
      name: 'OPEX',
    });
    policy = await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.SERVICE as any,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });

    // Required mapping for SUPPLY_INVOICE (used by /finance/documents/from-supply-receipt)
    const cfInvoice = await seedCashflowCategory({
      request,
      token,
      code: `CF_SUPINV_${String(Date.now()).slice(-6)}`,
      name: 'Supply invoices',
    });
    await seedCategoryDefaultMapping({
      request,
      token,
      sourceType: 'FINANCIAL_DOCUMENT_TYPE',
      sourceCode: 'SUPPLY_INVOICE',
      defaultCashflowCategoryId: cfInvoice.id,
    });

    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank FA',
          provider: 'Sber',
          externalRef: `bank-fa-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('happy path', async () => {
    // Create supply + supply item via public APIs
    supplyId = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplier.id,
          warehouseId: warehouse.id,
          currency: 'RUB',
          brandId: brand.id,
        })
        .expect(201)
    ).body.id;

    const supplyItem = (
      await request()
        .post(`/api/scm/supplies/${supplyId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          offerId: offer.id,
          quantityOrdered: 10,
          unit: 'pcs',
          pricePerUnit: 10,
          currency: 'RUB',
        })
        .expect(201)
    ).body;

    // Receive partial => creates receipt + stock movements + SUPPLY_RECEIPT entry + InventoryAccountingLink
    await request()
      .post(`/api/scm/supplies/${supplyId}/receive-partial`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            supplyItemId: supplyItem.id,
            quantity: 10,
            pricePerUnit: 10,
            currency: 'RUB',
          },
        ],
      })
      .expect(200);

    const receipts = await prisma.scmSupplyReceipt.findMany({
      where: { supplyId } as any,
      orderBy: { createdAt: 'asc' },
    });
    expect(receipts.length).toBe(1);
    receiptId = receipts[0].id;

    const supplyEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(supplyEntry?.debitAccount).toBe('10.01');
    expect(supplyEntry?.creditAccount).toBe('60.01');
    const invLinks = await prisma.inventoryAccountingLink.findMany({
      where: { accountingEntryId: supplyEntry!.id } as any,
    });
    expect(invLinks.length).toBeGreaterThan(0);

    // Create SupplyInvoice explicitly from receipt -> accrue (no double posting) -> pay -> reconcile
    const supplyInvoice = (
      await request()
        .post('/api/finance/documents/from-supply-receipt')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplyReceiptId: receiptId,
          invoiceNumber: `INV-FA-${Date.now()}`,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/documents/${supplyInvoice.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: PaymentRequestType.SERVICE,
          amount: '1000',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          financialDocumentId: supplyInvoice.id,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-requests/${pr.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/payment-requests/${pr.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);
    const plan = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: pr.id,
          plannedDate: new Date().toISOString(),
          plannedAmount: '1000',
          fromAccountId: bankAcc.id,
        })
        .expect(201)
    ).body;

    const bankRef = `FA-${Date.now()}`;
    const execRes = await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bankReference: bankRef, description: `Pay ${bankRef}` })
      .expect(200);
    paymentExecutionId = execRes.body.paymentExecution.id;

    const peEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: paymentExecutionId,
      } as any,
    });
    expect(peEntry?.debitAccount).toBe('60.01');
    expect(peEntry?.creditAccount).toBe('51.00');
    const mt = await prisma.moneyTransaction.findFirst({
      where: {
        sourceType: 'PAYMENT_EXECUTION' as any,
        sourceId: paymentExecutionId,
      } as any,
    });
    expect(mt?.id).toBeDefined();
    const cashLinks = await prisma.cashAccountingLink.findMany({
      where: {
        moneyTransactionId: mt!.id,
        role: 'PAYMENT_PRINCIPAL' as any,
      } as any,
    });
    expect(cashLinks.length).toBeGreaterThan(0);

    // Import bank statement line and reconcile through suggest/confirm/post
    const occurredAt = new Date(mt!.occurredAt);
    occurredAt.setUTCDate(occurredAt.getUTCDate() + 1);
    const imp = await request()
      .post('/api/finance/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: bankAcc.id,
        provider: StatementProvider.BANK,
        sourceName: 'Bank',
        importHash: `fa-${Date.now()}`,
        lines: [
          {
            occurredAt: occurredAt.toISOString(),
            direction: MoneyTransactionDirection.OUT,
            amount: '1000',
            currency: 'RUB',
            description: `Payment ${bankRef}`,
            bankReference: bankRef,
          },
        ],
      })
      .expect(200);
    const st = await request()
      .get(`/api/finance/statements/${imp.body.statementId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    statementLineId = st.body.lines[0].id;

    await request()
      .post(`/api/finance/statement-lines/${statementLineId}/suggest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/statement-lines/${statementLineId}/confirm-match`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'PAYMENT_EXECUTION', entityId: paymentExecutionId })
      .expect(200);
    const postRes = await request()
      .post(`/api/finance/statement-lines/${statementLineId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(postRes.body.line.status).toBe('POSTED');
    expect(postRes.body.line.postedMoneyTransactionId).toBe(mt!.id);

    // Explain cashflow (unified) shows chain to FinancialDocument/PaymentExecution/StatementLine
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const to = new Date(Date.now() + 1 * 86400000).toISOString();
    const exp = await request()
      .get(
        `/api/finance/reports/explain/cashflow?legalEntityId=${legalEntity.id}&from=${from}&to=${to}&cashflowCategoryId=${pr.cashflowCategoryId}&limit=50&offset=0`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const primaryTypes = new Set(
      exp.body.items.flatMap((it: any) =>
        (it.primary ?? []).map((p: any) => p.type),
      ),
    );
    expect(primaryTypes.has('FinancialDocument')).toBe(true);
    expect(primaryTypes.has('PaymentExecution')).toBe(true);
    expect(primaryTypes.has('StatementLine')).toBe(true);

    // Reports smoke
    await request()
      .get(
        `/api/finance/reports/cashflow?legalEntityId=${legalEntity.id}&from=${from.slice(0, 10)}&to=${to.slice(0, 10)}&groupBy=category&includeTransfers=true`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .get(
        `/api/finance/reports/balance-sheet?legalEntityId=${legalEntity.id}&at=${to.slice(0, 10)}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
