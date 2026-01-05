import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
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
