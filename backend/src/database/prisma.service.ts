import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createScopeExtension } from '../common/scope/prisma-scope.extension';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    const base = new PrismaClient();
    this.client = base.$extends(createScopeExtension()) as unknown as PrismaClient;

    // Proxy all PrismaClient model delegates/methods through this service instance
    // while keeping Nest lifecycle hooks (onModuleInit/onModuleDestroy) on the service.
    // eslint-disable-next-line no-constructor-return
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const value = (target.client as any)[prop];
        return typeof value === 'function' ? value.bind(target.client) : value;
      },
    }) as any;
  }

  async onModuleInit() {
    try {
      await this.client.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async enableShutdownHooks(app: any) {
    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await app.close();
    });

    process.on('SIGINT', async () => {
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await app.close();
      process.exit(0);
    });
  }
}

// TypeScript declaration merging:
// Our PrismaService is a Proxy over an extended PrismaClient instance.
// This makes PrismaService appear as PrismaClient to the type system.
export interface PrismaService extends PrismaClient {}
