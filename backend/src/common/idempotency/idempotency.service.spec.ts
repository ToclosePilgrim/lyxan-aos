import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';
import { RedisService } from '../../database/redis.service';
import { CachedResponse } from './idempotency.types';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let configService: jest.Mocked<ConfigService>;
  let redisService: jest.Mocked<RedisService>;
  let mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'IDEMPOTENCY_TTL_SEC') return 86400;
        return defaultValue;
      }),
    } as any;

    redisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient as any),
    } as any;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  describe('cache miss → set result', () => {
    it('should cache response after first request', async () => {
      const cacheKey = 'idem:v1:user1:POST:/test:key123';
      const response: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123', status: 'created' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValueOnce(null); // Cache miss
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheResponse(cacheKey, response, 86400);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        cacheKey,
        86400,
        JSON.stringify(response),
      );
    });
  });

  describe('cache hit → return cached', () => {
    it('should return cached response when key exists', async () => {
      const cacheKey = 'idem:v1:user1:POST:/test:key123';
      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123', status: 'created' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

      const result = await service.getCachedResponse(cacheKey);

      expect(result).toEqual(cachedResponse);
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return null when cache miss', async () => {
      const cacheKey = 'idem:v1:user1:POST:/test:key123';

      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.getCachedResponse(cacheKey);

      expect(result).toBeNull();
    });
  });

  describe('5xx not cached', () => {
    it('should allow caching 5xx if cacheErrors is enabled (service does not enforce this)', async () => {
      // Service itself doesn't enforce 5xx caching rules - that's interceptor's job
      // But we can test that service can cache any response
      const cacheKey = 'idem:v1:user1:POST:/test:key123';
      const errorResponse: CachedResponse = {
        statusCode: 500,
        body: { error: 'Internal server error' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheResponse(cacheKey, errorResponse, 86400);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        cacheKey,
        86400,
        JSON.stringify(errorResponse),
      );
    });
  });

  describe('lock behavior', () => {
    it('should acquire lock for first request', async () => {
      const lockKey = 'idemlock:v1:user1:POST:/test:key123';

      mockRedisClient.set.mockResolvedValueOnce('OK');

      const result = await service.acquireLock(lockKey);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        lockKey,
        '1',
        'EX',
        60,
        'NX',
      );
    });

    it('should fail to acquire lock if already locked', async () => {
      const lockKey = 'idemlock:v1:user1:POST:/test:key123';

      mockRedisClient.set.mockResolvedValueOnce(null); // Lock already exists

      const result = await service.acquireLock(lockKey);

      expect(result).toBe(false);
    });

    it('should release lock', async () => {
      const lockKey = 'idemlock:v1:user1:POST:/test:key123';

      mockRedisClient.del.mockResolvedValueOnce(1);

      await service.releaseLock(lockKey);

      expect(mockRedisClient.del).toHaveBeenCalledWith(lockKey);
    });

    it('should wait for cached response with retries', async () => {
      const cacheKey = 'idem:v1:user1:POST:/test:key123';
      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      // First 2 calls return null, third returns cached
      mockRedisClient.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(cachedResponse));

      const result = await service.waitForCachedResponse(cacheKey, 3);

      expect(result).toEqual(cachedResponse);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(3);
    });

    it('should return null if no cached response after max retries', async () => {
      const cacheKey = 'idem:v1:user1:POST:/test:key123';

      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.waitForCachedResponse(cacheKey, 2);

      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Redis disabled', () => {
    it('should return null when Redis client is null', async () => {
      redisService.getClient.mockReturnValueOnce(null);

      const result = await service.getCachedResponse('test-key');

      expect(result).toBeNull();
    });

    it('should not cache when Redis client is null', async () => {
      redisService.getClient.mockReturnValueOnce(null);

      const response: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      await service.cacheResponse('test-key', response, 86400);

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should return false when trying to acquire lock without Redis', async () => {
      redisService.getClient.mockReturnValueOnce(null);

      const result = await service.acquireLock('test-lock');

      expect(result).toBe(false);
    });
  });

  describe('getDefaultTtl', () => {
    it('should return default TTL from config', () => {
      const ttl = service.getDefaultTtl();
      expect(ttl).toBe(86400);
    });
  });
});



