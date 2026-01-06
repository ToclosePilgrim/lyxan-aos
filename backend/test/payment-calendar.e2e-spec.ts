import { INestApplication } from '@nestjs/common';
import { PaymentRequestType, PrismaClient } from '@prisma/client';
import { createTestApp } from './setup-e2e';
import {
  seedApprovalPolicy,
  seedCashflowCategory,
  seedCountry,
  seedLegalEntity,
} from './api-seed';

describe('Payment Calendar (e2e)', () => {
  let app: INestApplication;
  let request: () => any;
  let loginAsAdmin: () => Promise<string>;
  let token: string;
  const prisma = new PrismaClient();

  let legalEntity: any;
  let cashflowCategory: any;
  let pr: any;
  let prBacklog: any;
  let plan1: any;
  let plan2: any;

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
      code: `ZC-${ts}`,
      name: 'Z-Calendar',
    });
    legalEntity = await seedLegalEntity({
      request,
      token,
      code: `LE-CAL-${ts}`,
      name: `LE Calendar ${ts}`,
      countryCode: country.code,
    });

    cashflowCategory = await seedCashflowCategory({
      request,
      token,
      code: `CF-CAL-${ts}`,
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

    // Create + submit + approve payment request (amount 100)
    pr = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: PaymentRequestType.SUPPLY,
          amount: '100',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          cashflowCategoryId: cashflowCategory.id,
          linkedDocType: 'OTHER',
          linkedDocId: `doc-1:${ts}`,
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

    const d1 = new Date();
    d1.setUTCDate(d1.getUTCDate() + 1);
    const d2 = new Date();
    d2.setUTCDate(d2.getUTCDate() + 2);

    plan1 = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: pr.id,
          plannedDate: d1.toISOString(),
          plannedAmount: '60',
        })
        .expect(201)
    ).body;

    plan2 = (
      await request()
        .post('/api/finance/payment-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentRequestId: pr.id,
          plannedDate: d2.toISOString(),
          plannedAmount: '40',
        })
        .expect(201)
    ).body;

    // Backlog request: APPROVED but no plans
    prBacklog = (
      await request()
        .post('/api/finance/payment-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          legalEntityId: legalEntity.id,
          type: PaymentRequestType.SUPPLY,
          amount: '50',
          currency: 'RUB',
          plannedPayDate: new Date().toISOString(),
          cashflowCategoryId: cashflowCategory.id,
          linkedDocType: 'OTHER',
          linkedDocId: `doc-2:${ts}`,
        })
        .expect(201)
    ).body;

    await request()
      .post(`/api/finance/payment-requests/${prBacklog.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request()
      .post(`/api/finance/payment-requests/${prBacklog.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedBy: 'cfo@company', approverRole: 'CFO' })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('calendar returns items+day totals; move keeps audit; backlog includes approved w/o plans', async () => {
    const from = new Date();
    from.setUTCDate(from.getUTCDate());
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 7);

    const cal = await request()
      .get(
        `/api/finance/payment-calendar?legalEntityId=${legalEntity.id}&from=${from.toISOString()}&to=${to.toISOString()}&includeBacklog=true`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(cal.body.items)).toBe(true);
    expect(cal.body.items.length).toBe(2);
    expect(Array.isArray(cal.body.days)).toBe(true);
    expect(cal.body.days.length).toBeGreaterThanOrEqual(2);

    const totalBase = cal.body.days.reduce(
      (sum: number, d: any) => sum + Number(d.plannedOutBase),
      0,
    );
    expect(totalBase).toBeGreaterThan(0);

    expect(Array.isArray(cal.body.backlog)).toBe(true);
    const backlogIds = new Set(cal.body.backlog.map((b: any) => b.id));
    expect(backlogIds.has(prBacklog.id)).toBe(true);

    // Move first plan
    const newDate = new Date();
    newDate.setUTCDate(newDate.getUTCDate() + 3);
    const moved = await request()
      .post(`/api/finance/payment-plans/${plan1.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPlannedDate: newDate.toISOString() })
      .expect(200);
    expect(moved.body.newPlan.id).toBeDefined();

    const old = await prisma.paymentPlan.findUnique({
      where: { id: plan1.id },
    });
    expect(old?.status).toBe('MOVED');
    const fresh = await prisma.paymentPlan.findUnique({
      where: { id: moved.body.newPlan.id },
    });
    expect(fresh?.status).toBe('PLANNED');
    expect(fresh?.movedFromPlanId).toBe(plan1.id);

    expect(plan2.id).toBeDefined();
  });
});




