import { createTestApp } from './setup-e2e';

describe('Architecture Boundary: SCM suppliers API must not exist', () => {
  it('GET/POST/GET:id /api/scm/suppliers* -> 404/410', async () => {
    const { app, request, loginAsAdmin } = await createTestApp();
    const token = await loginAsAdmin();

    const methods: Array<{ method: 'get' | 'post'; url: string }> = [
      { method: 'get', url: '/api/scm/suppliers' },
      { method: 'post', url: '/api/scm/suppliers' },
      { method: 'get', url: '/api/scm/suppliers/any-id' },
    ];

    for (const m of methods) {
      const res = await (request() as any)
        [m.method](m.url)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect((r: any) => {
          if (![404, 410].includes(r.status)) {
            throw new Error(
              `Expected 404/410 for ${m.method.toUpperCase()} ${m.url}, got ${r.status}`,
            );
          }
        });
      expect([404, 410]).toContain(res.status);
    }

    await app.close();
  });
});

