import { INestApplication } from '@nestjs/common';
import {
  PaymentRequestStatus,
  PaymentRequestType,
  PrismaClient,
} from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('PaymentRequest + approvals (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let cashflowCategory: any;
  let pr: any;

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
      code: `ZP-${ts}`,
      name: 'Z-Payments',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-PR-${ts}`,
      name: `LE Payment Requests ${ts}`,
      countryCode: country.code,
    });

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-PR-${ts}`,
      name: 'Operations',
      isTransfer: false,
    });

    await seedApprovalPolicy({
      request,
      token,
      legalEntityId: legalEntity.id,
      type: PaymentRequestType.SUPPLY,
      amountBaseFrom: '0',
      amountBaseTo: null,
      approverRole: 'CFO',
      isAutoApprove: false,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates DRAFT, submit->SUBMITTED, approve->APPROVED; validates basis and status transitions', async () => {
    // Missing basis should fail
    await request()
      .post('/api/finance/payment-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: PaymentRequestType.SUPPLY,
        amount: '1000',
        currency: 'RUB',
        plannedPayDate: new Date().toISOString(),
        cashflowCategoryId: cashflowCategory.id,
      })
      .expect(400);

    // Create DRAFT with linked basis
    const createRes = await request()
      .post('/api/finance/payment-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId: legalEntity.id,
        type: PaymentRequestType.SUPPLY,
        amount: '1000',
        currency: 'RUB',
        plannedPayDate: new Date().toISOString(),
        cashflowCategoryId: cashflowCategory.id,
        linkedDocType: 'OTHER',
        linkedDocId: `test-doc:${Date.now()}`,
        description: 'Pay supplier',
      })
      .expect(201);

    pr = createRes.body;
    expect(pr.status).toBe(PaymentRequestStatus.DRAFT);

    // Approve from DRAFT should be forbidden
    await request()
      .post(`/api/finance/payment-requests/${pr.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(409);

    // Submit
    const submitted = await request()
      .post(`/api/finance/payment-requests/${pr.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(submitted.body.status).toBe(PaymentRequestStatus.SUBMITTED);

    // Approve with policy role
    const approved = await request()
      .post(`/api/finance/payment-requests/${pr.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);
    expect(approved.body.status).toBe(PaymentRequestStatus.APPROVED);
  });
});




