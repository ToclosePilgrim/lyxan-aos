import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENCY_METADATA_KEY } from './idempotency.decorator';
import { CachedResponse } from './idempotency.types';
import { lastValueFrom, of, throwError } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRequest = {
    method: 'POST',
    path: '/api/finance/documents',
    originalUrl: '/api/finance/documents',
    headers: {},
    params: {},
    user: { id: 'user-123' },
  };

  const mockResponse = {
    statusCode: 201,
    getHeader: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    // Reset mutable request object between tests (some tests change method to GET, etc.)
    mockRequest.method = 'POST';
    mockRequest.path = '/api/finance/documents';
    mockRequest.originalUrl = '/api/finance/documents';
    mockRequest.headers = {};
    mockRequest.params = {};
    mockRequest.user = { id: 'user-123' };
    (mockRequest as any).rawBody = undefined;
    (mockRequest as any).body = undefined;

    reflector = {
      get: jest.fn(),
    } as any;

    idempotencyService = {
      getCachedResponse: jest.fn(),
      cacheResponse: jest.fn(),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      waitForCachedResponse: jest.fn(),
      getDefaultTtl: jest.fn().mockReturnValue(86400),
    } as any;

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'IDEMPOTENCY_REQUIRED_IN_PROD') return 'true';
        return defaultValue;
      }),
    } as any;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: Reflector,
          useValue: reflector,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
  });

  describe('required=true and no header → 400', () => {
    it('should throw BadRequestException when key is required but missing', async () => {
      reflector.get.mockReturnValue({ required: true });
      mockRequest.headers = {};

      const context = createMockContext(mockRequest, mockResponse);

      await expect(
        runIntercept(context, createMockHandler()),
      ).rejects.toThrow(BadRequestException);
      await expect(
        runIntercept(context, createMockHandler()),
      ).rejects.toThrow('Idempotency-Key header is required');
    });
  });

  describe('header present → first call handler, second replay', () => {
    it('should call handler on first request and cache response', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(null); // Cache miss
      idempotencyService.acquireLock.mockResolvedValueOnce(true); // Lock acquired
      idempotencyService.cacheResponse.mockResolvedValueOnce(undefined);
      idempotencyService.releaseLock.mockResolvedValueOnce(undefined);

      const handler = createMockHandler({ id: 'doc-123' });
      const context = createMockContext(mockRequest, mockResponse);

      const result = await runIntercept(context, handler);

      expect(handler.handle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'doc-123' });
      expect(idempotencyService.cacheResponse).toHaveBeenCalled();
      expect(idempotencyService.releaseLock).toHaveBeenCalled();
    });

    it('should return cached response on second request without calling handler', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123', status: 'created' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(cachedResponse);

      const handler = createMockHandler();
      const context = createMockContext(mockRequest, mockResponse);

      const result = await runIntercept(context, handler);

      expect(handler.handle).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResponse.body);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Idempotency-Replay',
        '1',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('X-Idempotency-Replay header', () => {
    it('should set X-Idempotency-Replay header when returning cached response', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
      };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(cachedResponse);

      const context = createMockContext(mockRequest, mockResponse);

      await runIntercept(context, createMockHandler());

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Idempotency-Replay',
        '1',
      );
    });
  });

  describe('non-mutating methods', () => {
    it('should skip idempotency for GET requests', async () => {
      mockRequest.method = 'GET';
      reflector.get.mockReturnValue(undefined);

      const handler = createMockHandler({ data: 'test' });
      const context = createMockContext(mockRequest, mockResponse);

      const result = await runIntercept(context, handler);

      expect(handler.handle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'test' });
      expect(idempotencyService.getCachedResponse).not.toHaveBeenCalled();
    });
  });

  describe('concurrent requests', () => {
    it('should wait for cached response when lock is not acquired', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      idempotencyService.getCachedResponse
        .mockResolvedValueOnce(null) // First check: no cache
        .mockResolvedValueOnce(null); // After lock wait: still no cache
      idempotencyService.acquireLock.mockResolvedValueOnce(false); // Lock not acquired
      idempotencyService.waitForCachedResponse.mockResolvedValueOnce(null); // No cached response after wait

      const handler = createMockHandler();
      const context = createMockContext(mockRequest, mockResponse);

      await expect(
        runIntercept(context, handler),
      ).rejects.toThrow('Idempotency key is being processed');
    });
  });

  describe('bodyHash consistency check', () => {
    it('should reject request with same key but different body', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount: 1000 };
      // Simulate rawBody with different content
      const crypto = require('crypto');
      const differentBody = Buffer.from(JSON.stringify({ amount: 2000 }));
      (mockRequest as any).rawBody = differentBody;

      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
        requestHash: crypto.createHash('sha256').update(Buffer.from(JSON.stringify({ amount: 1000 }))).digest('hex'),
      };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(cachedResponse);

      const handler = createMockHandler();
      const context = createMockContext(mockRequest, mockResponse);

      await expect(
        runIntercept(context, handler),
      ).rejects.toThrow('Idempotency-Key has been used with a different request body');
    });

    it('should allow request with same key and same body', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount: 1000 };

      // Compute same hash from rawBody (Buffer)
      const crypto = require('crypto');
      const bodyBuffer = Buffer.from(JSON.stringify(mockRequest.body));
      const requestHash = crypto.createHash('sha256').update(bodyBuffer).digest('hex');
      (mockRequest as any).rawBody = bodyBuffer;

      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
        requestHash,
      };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(cachedResponse);

      const handler = createMockHandler();
      const context = createMockContext(mockRequest, mockResponse);

      const result = await runIntercept(context, handler);

      expect(result).toEqual(cachedResponse.body);
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('should fallback to JSON.stringify if rawBody not available', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { amount: 1000 };
      // No rawBody - should fallback to JSON.stringify
      (mockRequest as any).rawBody = undefined;

      const crypto = require('crypto');
      const bodyStr = JSON.stringify(mockRequest.body);
      const requestHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

      const cachedResponse: CachedResponse = {
        statusCode: 201,
        body: { id: 'doc-123' },
        contentType: 'application/json',
        createdAt: Date.now(),
        requestHash,
      };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(cachedResponse);

      const handler = createMockHandler();
      const context = createMockContext(mockRequest, mockResponse);

      const result = await runIntercept(context, handler);

      expect(result).toEqual(cachedResponse.body);
      expect(handler.handle).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should release lock on error', async () => {
      const idempotencyKey = 'test-key-1234567890';
      reflector.get.mockReturnValue({ required: false });
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      idempotencyService.getCachedResponse.mockResolvedValueOnce(null);
      idempotencyService.acquireLock.mockResolvedValueOnce(true);
      idempotencyService.releaseLock.mockResolvedValueOnce(undefined);

      const handler = {
        handle: () => throwError(() => new Error('Handler error')),
      };

      const context = createMockContext(mockRequest, mockResponse);

      await expect(
        runIntercept(context, handler),
      ).rejects.toThrow('Handler error');

      expect(idempotencyService.releaseLock).toHaveBeenCalled();
    });
  });

  // Helper functions
  async function runIntercept(context: ExecutionContext, handler: any) {
    const obs = await interceptor.intercept(context, handler);
    return lastValueFrom(obs);
  }

  function createMockContext(request: any, response: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }

  function createMockHandler(data: any = { id: 'test' }) {
    return {
      handle: jest.fn().mockReturnValue(of(data)),
    };
  }
});

