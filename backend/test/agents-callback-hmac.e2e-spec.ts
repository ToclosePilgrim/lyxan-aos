import { createTestApp } from './setup-e2e';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

describe('Agents Callback HMAC Security (e2e)', () => {
  let prisma: PrismaClient;
  const secret = process.env.AGENT_CALLBACK_HMAC_SECRET || 'test-secret-key';

  beforeAll(() => {
    // Set secret for tests
    process.env.AGENT_CALLBACK_HMAC_SECRET = secret;
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Helper function to compute HMAC signature
  function computeSignature(
    runId: string,
    timestamp: string,
    bodyHash: string,
    secret: string,
  ): string {
    const signingString = [
      'agents_callback.v1',
      runId,
      timestamp,
      bodyHash,
    ].join('\n');
    return crypto.createHmac('sha256', secret).update(signingString).digest('hex');
  }

  // Helper function to compute body hash
  function computeBodyHash(body: Buffer): string {
    return crypto.createHash('sha256').update(body).digest('hex');
  }

  it('should reject callback without headers', async () => {
    const { app, request } = await createTestApp();

    // Create an agent run
    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .send({ status: 'success', data: { result: 'ok' } })
      .expect(401);

    await app.close();
  });

  it('should reject callback with invalid Content-Type', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(
      agentRun.id,
      timestamp,
      bodyHash,
      secret,
    );

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'text/plain')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(415); // Unsupported Media Type

    await app.close();
  });

  it('should reject callback with invalid signature', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const invalidSignature = 'invalid-signature-hex';

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', invalidSignature)
      .send(payload)
      .expect(401);

    await app.close();
  });

  it('should reject callback with timestamp outside window', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    // Timestamp 10 minutes ago (outside 5-minute window)
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const signature = computeSignature(
      agentRun.id,
      oldTimestamp,
      bodyHash,
      secret,
    );

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', oldTimestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(401);

    await app.close();
  });

  it('should accept callback with valid signature and timestamp', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(
      agentRun.id,
      timestamp,
      bodyHash,
      secret,
    );

    const res = await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(200);

    expect(res.body).toHaveProperty('id', agentRun.id);
    expect(res.body).toHaveProperty('status', 'SUCCESS');
    expect(res.body).toHaveProperty('finishedAt');

    // Verify run was updated in database
    const updatedRun = await prisma.agentRun.findUnique({
      where: { id: agentRun.id },
    });
    expect(updatedRun?.status).toBe('SUCCESS');
    expect(updatedRun?.finishedAt).not.toBeNull();

    await app.close();
  });

  it('should reject replay of the same request', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(
      agentRun.id,
      timestamp,
      bodyHash,
      secret,
    );

    // First request should succeed
    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(200);

    // Second identical request should be rejected (replay)
    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(401);

    await app.close();
  });

  it('should accept different requests with same runId but different body', async () => {
    const { app, request } = await createTestApp();

    const agentRun = await prisma.agentRun.create({
      data: {
        agentKey: 'test_agent',
        status: 'RUNNING',
        input: {},
        startedAt: new Date(),
      },
    });

    // First request
    const payload1 = { status: 'success', data: { result: 'ok' } };
    const rawBody1 = Buffer.from(JSON.stringify(payload1));
    const bodyHash1 = computeBodyHash(rawBody1);
    const timestamp1 = Math.floor(Date.now() / 1000).toString();
    const signature1 = computeSignature(
      agentRun.id,
      timestamp1,
      bodyHash1,
      secret,
    );

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp1)
      .set('X-AOS-Signature', signature1)
      .send(payload1)
      .expect(200);

    // Second request with different body should succeed (different signature)
    const payload2 = { status: 'error', error: 'Something went wrong' };
    const rawBody2 = Buffer.from(JSON.stringify(payload2));
    const bodyHash2 = computeBodyHash(rawBody2);
    const timestamp2 = Math.floor(Date.now() / 1000).toString();
    const signature2 = computeSignature(
      agentRun.id,
      timestamp2,
      bodyHash2,
      secret,
    );

    await request()
      .post(`/api/agents/callback/${agentRun.id}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp2)
      .set('X-AOS-Signature', signature2)
      .send(payload2)
      .expect(200);

    await app.close();
  });

  it('should reject callback for non-existent runId', async () => {
    const { app, request } = await createTestApp();

    const fakeRunId = 'non-existent-run-id';
    const payload = { status: 'success', data: { result: 'ok' } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const bodyHash = computeBodyHash(rawBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(fakeRunId, timestamp, bodyHash, secret);

    await request()
      .post(`/api/agents/callback/${fakeRunId}`)
      .set('Content-Type', 'application/json')
      .set('X-AOS-Timestamp', timestamp)
      .set('X-AOS-Signature', signature)
      .send(payload)
      .expect(404); // Should pass HMAC but fail on runId lookup

    await app.close();
  });
});


