import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import crypto from 'crypto';
import { Reflector } from '@nestjs/core';
import { Observable, defer, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';
import {
  IdempotencyOptions,
  CachedResponse,
  IdempotencyMetadata,
} from './idempotency.types';
import { IDEMPOTENCY_METADATA_KEY } from './idempotency.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly nodeEnv: string;
  private readonly requiredInProd: boolean;

  constructor(
    private reflector: Reflector,
    private idempotencyService: IdempotencyService,
    private configService: ConfigService,
  ) {
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.requiredInProd =
      this.configService.get<string>('IDEMPOTENCY_REQUIRED_IN_PROD', 'true') ===
      'true';
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to mutating methods
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Get decorator options
    const options: IdempotencyOptions | undefined = this.reflector.get(
      IDEMPOTENCY_METADATA_KEY,
      context.getHandler(),
    );

    // If no decorator and not required globally, skip
    if (!options && !this.requiredInProd) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = this.getIdempotencyKey(request);

    // Check if required
    const isRequired =
      options?.required ??
      (this.requiredInProd && this.nodeEnv === 'production' && !!options);

    if (isRequired && !idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for this endpoint',
      );
    }

    if (!idempotencyKey) {
      // Not required, just log warning
      this.logger.warn(
        `Idempotency-Key missing for ${method} ${request.path} (not required)`,
      );
      return next.handle();
    }

    // Validate key format
    if (!this.isValidKey(idempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key must be 10-200 ASCII characters',
      );
    }

    // Build cache key
    const userScope = this.getUserScope(request);
    const path = request.originalUrl?.split('?')[0] || request.path;
    const cacheKey = `idem:v1:${userScope}:${method}:${path}:${idempotencyKey}`;
    const lockKey = `idemlock:v1:${userScope}:${method}:${path}:${idempotencyKey}`;

    // Store metadata in request for logging
    (request as any).idempotencyMetadata = {
      key: idempotencyKey,
      cacheKey,
      lockKey,
      options: options || {},
      isReplay: false,
    } as IdempotencyMetadata;

    // Compute request body hash for consistency check
    // Use rawBody (Buffer) if available, fallback to JSON.stringify for compatibility
    let requestHash: string | null = null;
    if ((request as any).rawBody) {
      requestHash = crypto
        .createHash('sha256')
        .update((request as any).rawBody)
        .digest('hex');
    } else if (request.body) {
      // Fallback: if rawBody not available, use JSON.stringify
      // This maintains compatibility but is less precise
      const requestBody = JSON.stringify(request.body);
      requestHash = crypto
        .createHash('sha256')
        .update(requestBody)
        .digest('hex');
    }

    // Check for cached response
    const cached = await this.idempotencyService.getCachedResponse(cacheKey);
    if (cached) {
      // Security check: same key must have same body
      if (requestHash && cached.requestHash && requestHash !== cached.requestHash) {
        this.logger.warn(
          `Idempotency key reuse detected with different body for key: ${idempotencyKey.substring(0, 20)}...`,
        );
        throw new ConflictException(
          'Idempotency-Key has been used with a different request body',
        );
      }

      this.logger.log(
        `Idempotency hit for key: ${idempotencyKey.substring(0, 20)}...`,
      );
      (request as any).idempotencyMetadata.isReplay = true;
      return this.returnCachedResponse(response, cached);
    }

    // Try to acquire lock for concurrent requests
    const lockAcquired = await this.idempotencyService.acquireLock(lockKey);
    if (!lockAcquired) {
      // Another request is processing, wait for cached response
      this.logger.debug(
        `Lock not acquired, waiting for cached response: ${idempotencyKey.substring(0, 20)}...`,
      );
      const waitedCached = await this.idempotencyService.waitForCachedResponse(
        cacheKey,
      );

      if (waitedCached) {
        // Security check: same key must have same body
        if (
          requestHash &&
          waitedCached.requestHash &&
          requestHash !== waitedCached.requestHash
        ) {
          this.logger.warn(
            `Idempotency key reuse detected with different body after wait for key: ${idempotencyKey.substring(0, 20)}...`,
          );
          throw new ConflictException(
            'Idempotency-Key has been used with a different request body',
          );
        }

        this.logger.log(
          `Idempotency hit after lock wait for key: ${idempotencyKey.substring(0, 20)}...`,
        );
        (request as any).idempotencyMetadata.isReplay = true;
        return this.returnCachedResponse(response, waitedCached);
      }

      // Still no cached response - request is in progress
      throw new ConflictException(
        'Idempotency key is being processed by another request',
      );
    }

    // Lock acquired - execute handler and cache response
    this.logger.debug(
      `Lock acquired, executing handler for key: ${idempotencyKey.substring(0, 20)}...`,
    );

    let responseBody: any;
    let statusCode: number;
    let contentType: string;

    return next.handle().pipe(
      mergeMap((data) =>
        defer(async () => {
          responseBody = data;
          statusCode = response.statusCode || HttpStatus.OK;
          contentType =
            response.getHeader('content-type')?.toString() ||
            'application/json';

          try {
            const shouldCache = this.shouldCacheResponse(
              statusCode,
              options?.cacheErrors,
            );
            if (shouldCache) {
              const ttlSec =
                options?.ttlSec || this.idempotencyService.getDefaultTtl();
              await this.idempotencyService.cacheResponse(
                cacheKey,
                {
                  statusCode,
                  body: responseBody,
                  contentType,
                  createdAt: Date.now(),
                  headers: this.getSafeHeaders(response),
                  requestHash: requestHash || undefined,
                },
                ttlSec,
              );
              this.logger.log(
                `Cached response for key: ${idempotencyKey.substring(0, 20)}...`,
              );
            }
          } finally {
            await this.idempotencyService.releaseLock(lockKey);
          }

          return responseBody;
        }),
      ),
      catchError((error) =>
        defer(async () => {
          // Always release lock on error
          await this.idempotencyService.releaseLock(lockKey);

          // Optionally cache error responses
          if (options?.cacheErrors) {
            const errorStatusCode =
              error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            const errorContentType = 'application/json';
            const errorBody = {
              statusCode: error.status,
              message: error.message,
            };

            const ttlSec =
              options?.ttlSec || this.idempotencyService.getDefaultTtl();
            await this.idempotencyService.cacheResponse(
              cacheKey,
              {
                statusCode: errorStatusCode,
                body: errorBody,
                contentType: errorContentType,
                createdAt: Date.now(),
              },
              ttlSec,
            );
          }

          throw error;
        }),
      ),
    );
  }

  private getIdempotencyKey(request: Request): string | null {
    const key =
      request.headers['idempotency-key'] ||
      request.headers['Idempotency-Key'];
    return key ? String(key).trim() : null;
  }

  private isValidKey(key: string): boolean {
    if (key.length < 10 || key.length > 200) {
      return false;
    }
    // Check if all characters are ASCII
    return /^[\x00-\x7F]+$/.test(key);
  }

  private getUserScope(request: Request & { user?: any }): string {
    const user = request.user;
    if (!user) {
      return 'anonymous';
    }

    // Try to get userId
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      return 'anonymous';
    }

    // Optionally include legalEntityId if available
    const legalEntityId = user.legalEntityId;
    if (legalEntityId) {
      return `${legalEntityId}:${userId}`;
    }

    return String(userId);
  }

  private shouldCacheResponse(
    statusCode: number,
    cacheErrors?: boolean,
  ): boolean {
    // Don't cache 5xx by default
    if (statusCode >= 500 && !cacheErrors) {
      return false;
    }

    // Don't cache 4xx by default (unless explicitly enabled)
    if (statusCode >= 400 && statusCode < 500 && !cacheErrors) {
      return false;
    }

    return true;
  }

  private getSafeHeaders(response: Response): Record<string, string> {
    const safe: Record<string, string> = {};
    const contentType = response.getHeader('content-type');
    const requestId = response.getHeader('x-request-id');

    if (contentType) {
      safe['content-type'] = String(contentType);
    }
    if (requestId) {
      safe['x-request-id'] = String(requestId);
    }

    return safe;
  }

  private returnCachedResponse(
    response: Response,
    cached: CachedResponse,
  ): Observable<any> {
    // Set status
    response.status(cached.statusCode);

    // Set headers
    response.setHeader('X-Idempotency-Replay', '1');
    if (cached.contentType) {
      response.setHeader('Content-Type', cached.contentType);
    }
    if (cached.headers) {
      Object.entries(cached.headers).forEach(([key, value]) => {
        response.setHeader(key, value);
      });
    }

    // Return cached body
    return of(cached.body);
  }
}

