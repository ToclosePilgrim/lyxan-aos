import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

// Устанавливаем NODE_ENV=test для e2e тестов
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  httpServer: any;
  request: () => supertest.SuperTest<supertest.Test>;
  loginAsAdmin: () => Promise<string>;
}> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Настройки из main.ts
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.init();
  const httpServer = app.getHttpServer();

  const request = () => supertest(httpServer);

  // Helper для логина админа
  const loginAsAdmin = async () => {
    const res = await request()
      .post('/api/auth/login')
      .send({
        email: 'admin@aos.local',
        password: 'Tairai123',
      })
      .expect(200);

    const accessToken = res.body.accessToken;
    if (!accessToken) {
      throw new Error('Failed to get access token from login response');
    }
    return accessToken as string;
  };

  return {
    app,
    httpServer,
    request,
    loginAsAdmin,
  };
}

