import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../database/redis.service';
import { CachedResponse } from './idempotency.types';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTtlSec: number;
  private readonly lockTtlSec = 60; // Lock timeout: 60 seconds
  private readonly maxRetries = 5; // Max retries for lock acquisition
  private readonly retryDelayMs = 100; // Initial retry delay

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.defaultTtlSec = this.configService.get<number>(
      'IDEMPOTENCY_TTL_SEC',
      86400, // 24 hours
    );
  }

  /**
   * Get cached response by key
   */
  async getCachedResponse(
    cacheKey: string,
  ): Promise<CachedResponse | null> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      this.logger.warn('Redis not available - idempotency disabled');
      return null;
    }

    try {
      const cached = await redisClient.get(cacheKey);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as CachedResponse;
    } catch (error) {
      this.logger.error(`Failed to get cached response: ${error}`);
      return null;
    }
  }

  /**
   * Cache response with TTL
   */
  async cacheResponse(
    cacheKey: string,
    response: CachedResponse,
    ttlSec: number,
  ): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      return;
    }

    try {
      const serialized = JSON.stringify(response);
      await redisClient.setex(cacheKey, ttlSec, serialized);
      this.logger.debug(`Cached response for key: ${cacheKey.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error(`Failed to cache response: ${error}`);
    }
  }

  /**
   * Try to acquire lock for concurrent request protection
   * Returns true if lock acquired, false otherwise
   */
  async acquireLock(lockKey: string): Promise<boolean> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      return false;
    }

    try {
      // SET lock NX EX 60 - set only if not exists, with expiration
      const result = await redisClient.set(
        lockKey,
        '1',
        'EX',
        this.lockTtlSec,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${error}`);
      return false;
    }
  }

  /**
   * Release lock
   */
  async releaseLock(lockKey: string): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      return;
    }

    try {
      await redisClient.del(lockKey);
    } catch (error) {
      this.logger.error(`Failed to release lock: ${error}`);
    }
  }

  /**
   * Wait for cached response with retries (for concurrent requests)
   */
  async waitForCachedResponse(
    cacheKey: string,
    maxRetries: number = this.maxRetries,
  ): Promise<CachedResponse | null> {
    let delay = this.retryDelayMs;

    for (let i = 0; i < maxRetries; i++) {
      await this.sleep(delay);

      const cached = await this.getCachedResponse(cacheKey);
      if (cached) {
        this.logger.debug(
          `Found cached response after ${i + 1} retries for key: ${cacheKey.substring(0, 20)}...`,
        );
        return cached;
      }

      // Exponential backoff
      delay = Math.min(delay * 2, 500);
    }

    return null;
  }

  /**
   * Get default TTL
   */
  getDefaultTtl(): number {
    return this.defaultTtlSec;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}



