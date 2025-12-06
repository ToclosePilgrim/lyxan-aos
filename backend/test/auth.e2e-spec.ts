import { createTestApp } from './setup-e2e';

describe('Auth e2e', () => {
  it('POST /api/auth/login should login seeded admin', async () => {
    const { app, request } = await createTestApp();

    const res = await request()
      .post('/api/auth/login')
      .send({
        email: 'admin@aos.local',
        password: 'Tairai123',
      })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', 'admin@aos.local');

    await app.close();
  });

  it('POST /api/auth/login should reject invalid credentials', async () => {
    const { app, request } = await createTestApp();

    await request()
      .post('/api/auth/login')
      .send({
        email: 'admin@aos.local',
        password: 'wrongpassword',
      })
      .expect(401);

    await app.close();
  });

  it('GET /api/auth/me should return current user with valid token', async () => {
    const { app, request } = await createTestApp();

    // Сначала логинимся
    const loginRes = await request()
      .post('/api/auth/login')
      .send({
        email: 'admin@aos.local',
        password: 'Tairai123',
      })
      .expect(200);

    const accessToken = loginRes.body.accessToken;

    // Получаем информацию о текущем пользователе
    const meRes = await request()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body).toHaveProperty('email', 'admin@aos.local');

    await app.close();
  });
});

