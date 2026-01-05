import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaService } from './database/prisma.service';
import { validateEnvOrThrow } from './config/env';

async function bootstrap() {
  validateEnvOrThrow();
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  // Expose /health and /health/db without /api prefix for release readiness checks.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/(.*)'] });

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Request logging is handled by requestIdMiddleware (structured logs with requestId)

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Ly[x]an AOS API')
    .setDescription('Agentic Operating System API Documentation')
    .setVersion('0.1.0')
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown for Prisma
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // OS self-validate (optional; avoid static import so broken OS stubs don't break compilation)
  const mode = configService.get('OS_SELF_VALIDATE_MODE') ?? 'strict';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OsSelfValidateService } = require('./modules/os/os-self-validate.service');
    const selfValidate = app.get(OsSelfValidateService);
    await selfValidate.validateAll();
  } catch (err: any) {
    // If module is missing/broken -> treat as "skipped" unless strict
    const msg = String(err?.message ?? err ?? '');
    const missingModule =
      msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND');
    if (!missingModule) {
      console.error(
        '[OS SELF VALIDATE FAILED]',
        err?.code ?? err?.message,
        err?.details ?? err,
      );
    }
    if (mode === 'strict' && !missingModule) {
      process.exit(1);
    }
  }

  const port = configService.get('PORT', 3001);
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
}
bootstrap();
