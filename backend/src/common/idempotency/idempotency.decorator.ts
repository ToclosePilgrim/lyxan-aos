import { SetMetadata } from '@nestjs/common';
import { IdempotencyOptions } from './idempotency.types';

export const IDEMPOTENCY_METADATA_KEY = 'idempotency';

/**
 * Decorator to configure idempotency behavior for an endpoint
 *
 * @example
 * @Idempotency({ required: true, ttlSec: 3600 })
 * @Post('create')
 * async create(@Body() dto: CreateDto) { ... }
 */
export const Idempotency = (options?: IdempotencyOptions) =>
  SetMetadata(IDEMPOTENCY_METADATA_KEY, options || {});



