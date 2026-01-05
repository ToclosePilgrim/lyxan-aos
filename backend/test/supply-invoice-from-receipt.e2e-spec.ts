import { INestApplication } from '@nestjs/common';
import {
  AccountingDocType,
  CounterpartyRole,
  FinanceCategoryMappingSourceType,
  FinancialAccountType,
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
  seedCountry,
  seedLegalEntity,
  seedMdmItem,
  seedWarehouse,
  seedCategoryDefaultMapping,
} from './api-seed';

describe('TZ 8.3.B.3 — SupplyInvoice from SupplyReceipt contract (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let token: string;
  const prisma = new PrismaClient();

  let country: any;
  let legalEntity: any;
  let brand: any;
  let warehouse: any;
  let supplier: any;
  let item: any;
  let offer: any;
  let cashflowCategory: any;
  let bankAcc: any;
  let approvalPolicy: any;

  let supplyId: string;
  let receiptId: string;
  let invoiceDoc: any;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    request = testApp.request;
    token = await testApp.loginAsAdmin();

    const ts = Date.now();
    country = await seedCountry({
      request,
      token,
      code: `ZSI-${ts}`,
      name: 'Z-Supply-Invoice',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-SI-${ts}`,
      name: `LE SupplyInvoice ${ts}`,
      countryCode: country.code,
    });
    brand = await seedBrand({
      request,
      token,
      code: `BR-SI-${ts}`,
      name: `Brand SupplyInvoice ${ts}`,
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
      code: `WH-SI-${ts}`,
      name: `WH SI ${ts}`,
      type: 'OWN',
      countryId: country.id,
    });

    supplier = (
      await request()
        .post('/api/mdm/counterparties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Supplier SI ${Date.now()}`,
          code: `SUP-SI-${Date.now()}`,
          roles: [CounterpartyRole.SUPPLIER],
        })
        .expect(201)
    ).body;

    item = await seedMdmItem({
      request,
      token,
      type: 'MATERIAL',
      code: `MAT-SI-${Date.now()}`,
      name: 'Material SI',
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
          sku: `VSKU-SI-${Date.now()}`,
          currency: 'RUB',
          price: 10,
          externalRef: `SI-OFFER-${Date.now()}`,
        })
        .expect(201)
    ).body;

    // Categories + mapping for SUPPLY_INVOICE (required by endpoint)
    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF_SI_${Date.now()}`,
      name: 'Supply invoices',
      isTransfer: false,
    });
    await seedCategoryDefaultMapping({
      request,
      token,
      legalEntityId: legalEntity.id,
      sourceType: FinanceCategoryMappingSourceType.FINANCIAL_DOCUMENT_TYPE,
      sourceCode: 'SUPPLY_INVOICE',
      defaultCashflowCategoryId: cashflowCategory.id,
      defaultPnlCategoryId: null,
      priority: 100,
      isActive: true,
    });

    approvalPolicy = await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.SERVICE,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: true,
    });

    bankAcc = (
      await request()
        .post('/api/finance/financial-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: FinancialAccountType.BANK_ACCOUNT,
          currency: 'RUB',
          name: 'Bank SI',
          provider: 'Sber',
          externalRef: `bank-si-${Date.now()}`,
        })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('receipt posts Inventory/AP; invoice-from-receipt accrues without duplicate posting; payment executes', async () => {
    supplyId = (
      await request()
        .post('/api/scm/supplies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierCounterpartyId: supplier.id,
          warehouseId: warehouse.id,
          currency: 'RUB',
          brandId: brand.id,
          status: 'ORDERED',
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

    const receiptEntry = await prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(receiptEntry?.debitAccount).toBe('10.01');
    expect(receiptEntry?.creditAccount).toBe('60.01');

    // Create SupplyInvoice explicitly from receipt (idempotent)
    invoiceDoc = (
      await request()
        .post('/api/finance/documents/from-supply-receipt')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplyReceiptId: receiptId,
          invoiceNumber: `INV-${Date.now()}`,
          invoiceDate: new Date().toISOString(),
        })
        .expect(201)
    ).body;
    expect(invoiceDoc?.id).toBeDefined();

    // Accrue invoice: should NOT create another Inventory/AP entry (only mark accrued; maybe delta entry)
    await request()
      .post(`/api/finance/documents/${invoiceDoc.id}/accrue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const after = await prisma.financialDocument.findUnique({
      where: { id: invoiceDoc.id } as any,
    });
    expect((after as any)?.isAccrued).toBe(true);

    const receiptEntriesCount = await prisma.accountingEntry.count({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receiptId,
      } as any,
    });
    expect(receiptEntriesCount).toBe(1);

    // Create payment request for the invoice and execute
    const pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: PaymentRequestType.SERVICE,
          amount: String((after as any).amountTotal ?? '0'),
          currency: (after as any).currency ?? 'RUB',
          plannedPayDate: new Date().toISOString(),
          financialDocumentId: invoiceDoc.id,
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

    // Plan it (official API)
    const plan = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: pr.id,
          plannedDate: new Date().toISOString(),
          plannedAmount: String((after as any).amountTotal ?? '0'),
          fromAccountId: bankAcc.id,
        })
        .expect(201)
    ).body;
    expect(plan?.id).toBeDefined();

    // Execute payment (must not 409 due to not accrued)
    const bankRef = `SI-${Date.now()}`;
    await request()
      .post(`/api/finance/payment-plans/${plan.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bankReference: bankRef, description: `Pay ${bankRef}` })
      .expect(200);
  }, 180_000);
});
