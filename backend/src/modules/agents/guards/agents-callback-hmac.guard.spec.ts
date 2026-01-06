import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AgentsCallbackHmacGuard } from './agents-callback-hmac.guard';
import { RedisService } from '../../../database/redis.service';
import {
  sha256Hex,
  hmacSha256Hex,
  buildSigningString,
} from './agents-callback-hmac.util';

describe('AgentsCallbackHmacGuard', () => {
  let guard: AgentsCallbackHmacGuard;
  let configService: jest.Mocked<ConfigService>;
  let redisService: jest.Mocked<RedisService>;
  let mockRedisClient: {
    get: jest.Mock;
    setex: jest.Mock;
  };

  const secret = 'test-secret-key';
  const runId = 'test-run-id-123';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = { status: 'success', data: { result: 'ok' } };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const bodyHash = sha256Hex(rawBody);
  const signingString = buildSigningString(runId, timestamp, bodyHash);
  const validSignature = hmacSha256Hex(secret, signingString);

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'AGENT_CALLBACK_HMAC_SECRET') return secret;
        if (key === 'AGENT_CALLBACK_HMAC_WINDOW_SEC') return 300;
        if (key === 'AGENT_CALLBACK_REPLAY_TTL_SEC') return 600;
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
        AgentsCallbackHmacGuard,
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

    guard = module.get<AgentsCallbackHmacGuard>(AgentsCallbackHmacGuard);
  });

  describe('missing headers', () => {
    it('should throw UnauthorizedException when timestamp header is missing', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-signature': validSignature,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing required headers',
      );
    });

    it('should throw UnauthorizedException when signature header is missing', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing required headers',
      );
    });

    it('should throw UnauthorizedException when both headers are missing', async () => {
      const context = createMockContext({
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('bad timestamp format', () => {
    it('should throw UnauthorizedException when timestamp is not numeric', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': 'not-a-number',
          'x-aos-signature': validSignature,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid timestamp format',
      );
    });
  });

  describe('stale timestamp', () => {
    it('should throw UnauthorizedException when timestamp is too old', async () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': oldTimestamp,
          'x-aos-signature': validSignature,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Request timestamp is outside acceptable window',
      );
    });

    it('should throw UnauthorizedException when timestamp is too far in future', async () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString();
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': futureTimestamp,
          'x-aos-signature': validSignature,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Request timestamp is outside acceptable window',
      );
    });
  });

  describe('bad signature', () => {
    it('should throw UnauthorizedException when signature is invalid', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': 'invalid-signature',
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid signature',
      );
    });

    it('should throw UnauthorizedException when signature length mismatch', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': 'short',
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid signature',
      );
    });
  });

  describe('Content-Type validation', () => {
    it('should throw UnsupportedMediaTypeException when Content-Type is not application/json', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'text/plain',
        },
        rawBody,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Content-Type must be application/json',
      );
    });

    it('should throw UnsupportedMediaTypeException when Content-Type is missing', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          // override default header from helper
          'content-type': '',
        },
        rawBody,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('should accept application/json Content-Type', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should accept application/json with charset', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json; charset=utf-8',
        },
        rawBody,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('missing rawBody', () => {
    it('should throw UnauthorizedException when rawBody is missing', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody: undefined,
      });

      try {
        await guard.canActivate(context);
        throw new Error('Expected UnauthorizedException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(String(e.message)).toContain('Request body is required');
      }
    });
  });

  describe('valid signature', () => {
    it('should return true when signature is valid and timestamp is within window', async () => {
      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('agent_cb_replay:v1:'),
        600,
        '1',
      );
    });
  });

  describe('replay detected', () => {
    it('should throw UnauthorizedException when replay key exists in Redis', async () => {
      mockRedisClient.get.mockResolvedValueOnce('1'); // Replay detected

      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody,
      });

      try {
        await guard.canActivate(context);
        throw new Error('Expected UnauthorizedException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(String(e.message)).toContain('Request replay detected');
      }
    });
  });

  describe('Redis disabled (test mode)', () => {
    it('should allow request when Redis client is null (test mode)', async () => {
      redisService.getClient.mockReturnValueOnce(null);

      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when Redis is null in production', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'AGENT_CALLBACK_HMAC_SECRET') return secret;
        if (key === 'AGENT_CALLBACK_HMAC_WINDOW_SEC') return 300;
        if (key === 'AGENT_CALLBACK_REPLAY_TTL_SEC') return 600;
        return undefined;
      });

      // Create new guard instance with production config
      const productionGuard = new AgentsCallbackHmacGuard(
        configService,
        redisService,
      );

      redisService.getClient.mockReturnValueOnce(null);

      const context = createMockContext({
        headers: {
          'x-aos-timestamp': timestamp,
          'x-aos-signature': validSignature,
          'content-type': 'application/json',
        },
        rawBody,
      });

      try {
        await productionGuard.canActivate(context);
        throw new Error('Expected UnauthorizedException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(String(e.message)).toContain(
          'Redis is required for replay protection in production',
        );
      }
    });
  });

  describe('production fail-fast', () => {
    it('should throw error on initialization if secret is missing in production', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'AGENT_CALLBACK_HMAC_SECRET') return '';
        return undefined;
      });

      expect(() => {
        new AgentsCallbackHmacGuard(configService, redisService);
      }).toThrow('AGENT_CALLBACK_HMAC_SECRET is required in production');
    });
  });

  // Helper function to create mock execution context
  function createMockContext(overrides: {
    headers?: Record<string, string>;
    rawBody?: Buffer;
    runId?: string;
  }) {
    const defaultRunId = overrides.runId || runId;
    const defaultHeaders = {
      'content-type': 'application/json',
      ...overrides.headers,
    };
    const defaultRawBody =
      Object.prototype.hasOwnProperty.call(overrides, 'rawBody')
        ? overrides.rawBody
        : rawBody;

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { runId: defaultRunId },
          headers: defaultHeaders,
          rawBody: defaultRawBody,
        }),
      }),
    } as any;
  }
});


