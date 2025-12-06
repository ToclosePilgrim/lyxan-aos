import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/auth/me (GET) should return 401 unauthorized by default', () => {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
  });
});
