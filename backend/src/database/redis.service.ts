import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    // Unit tests run with NODE_ENV=test and should not require a real Redis.
    // E2E tests, however, rely on Redis for idempotency + replay protection.
    this.isTestMode =
      process.env.NODE_ENV === 'test' &&
      String(process.env.AOS_E2E ?? '').toLowerCase() !== 'true';

    if (this.isTestMode) {
      this.logger.log('Redis disabled in test environment');
      this.client = null;
      return;
    }

    const redisUrl = configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        // В test режиме не пытаемся переподключаться
        if (this.isTestMode) {
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: this.isTestMode ? 0 : 3,
      enableOfflineQueue: !this.isTestMode, // Отключаем очередь оффлайн запросов в test режиме
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Connecting to Redis...');
    });

    this.client.on('ready', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.client.on('error', (error) => {
      // В test режиме только логируем, не падаем
      if (this.isTestMode) {
        this.logger.warn('Redis connection error (test mode):', error.message);
      } else {
        this.logger.error('Redis connection error', error);
      }
    });

    this.client.on('close', () => {
      if (!this.isTestMode) {
        this.logger.log('Redis connection closed');
      }
    });
  }

  getClient(): Redis | null {
    if (this.isTestMode) {
      this.logger.warn('Redis is disabled in test environment');
      return null;
    }
    return this.client;
  }

  async onModuleInit() {
    // Connection is handled by constructor
    if (this.isTestMode) {
      return;
    }
  }

  async onModuleDestroy() {
    if (this.isTestMode || !this.client) {
      return;
    }
    try {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    } catch (error) {
      // Игнорируем ошибки при закрытии в test режиме
      if (!this.isTestMode) {
        this.logger.error('Error disconnecting from Redis', error);
      }
    }
  }
}
