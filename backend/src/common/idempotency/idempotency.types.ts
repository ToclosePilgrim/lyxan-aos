/**
 * Cached response structure stored in Redis
 */
export interface CachedResponse {
  statusCode: number;
  body: unknown;
  contentType: string;
  createdAt: number;
  headers?: Record<string, string>;
  requestHash?: string; // SHA256 hash of request body for consistency check
}

/**
 * Options for @Idempotency() decorator
 */
export interface IdempotencyOptions {
  /**
   * Whether idempotency key is required for this endpoint
   * If true and key is missing → 400
   * Default: false (unless required in production for selected endpoints)
   */
  required?: boolean;

  /**
   * TTL in seconds for cached response
   * Default: IDEMPOTENCY_TTL_SEC env var or 86400 (24 hours)
   */
  ttlSec?: number;

  /**
   * Whether to cache error responses (4xx/5xx)
   * Default: false (errors are not cached)
   */
  cacheErrors?: boolean;
}

/**
 * Metadata stored in request context by interceptor
 */
export interface IdempotencyMetadata {
  key: string;
  cacheKey: string;
  lockKey: string;
  options: IdempotencyOptions;
  isReplay: boolean;
}

