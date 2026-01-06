import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import crypto from 'crypto';
import { RedisService } from '../../../database/redis.service';
import {
  sha256Hex,
  hmacSha256Hex,
  buildSigningString,
} from './agents-callback-hmac.util';

@Injectable()
export class AgentsCallbackHmacGuard implements CanActivate {
  private readonly logger = new Logger(AgentsCallbackHmacGuard.name);
  private readonly secret: string;
  private readonly windowSec: number;
  private readonly replayTtlSec: number;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.secret =
      this.configService.get<string>('AGENT_CALLBACK_HMAC_SECRET') || '';

    // Fail-fast in production if secret is missing
    if (!this.secret && nodeEnv === 'production') {
      throw new Error(
        'AGENT_CALLBACK_HMAC_SECRET is required in production environment',
      );
    }

    // Warn in development if secret is missing
    if (!this.secret && nodeEnv !== 'production') {
      this.logger.warn(
        'AGENT_CALLBACK_HMAC_SECRET is not set. HMAC verification will fail.',
      );
    }

    this.windowSec = this.configService.get<number>(
      'AGENT_CALLBACK_HMAC_WINDOW_SEC',
      300,
    );
    this.replayTtlSec = this.configService.get<number>(
      'AGENT_CALLBACK_REPLAY_TTL_SEC',
      600,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const runId = request.params.runId;

    if (!runId) {
      this.logger.warn('Missing runId in request params');
      throw new UnauthorizedException('Missing runId');
    }

    // Check Content-Type to ensure stable body serialization
    // Only application/json is allowed to prevent signature mismatches
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      this.logger.warn(
        `Invalid Content-Type for runId ${runId}: ${contentType}. Only application/json is allowed.`,
      );
      throw new UnsupportedMediaTypeException(
        'Content-Type must be application/json',
      );
    }

    // Check required headers
    const timestampHeader = request.headers['x-aos-timestamp'];
    const signatureHeader = request.headers['x-aos-signature'];

    if (!timestampHeader || !signatureHeader) {
      this.logger.warn(
        `Missing required headers for runId ${runId}. Timestamp: ${!!timestampHeader}, Signature: ${!!signatureHeader}`,
      );
      throw new UnauthorizedException('Missing required headers: X-AOS-Timestamp, X-AOS-Signature');
    }

    const timestamp = String(timestampHeader);
    const signature = String(signatureHeader);

    // Validate timestamp format (should be numeric)
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      this.logger.warn(`Invalid timestamp format for runId ${runId}: ${timestamp}`);
      throw new UnauthorizedException('Invalid timestamp format');
    }

    // Check timestamp window
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - timestampNum);
    if (timeDiff > this.windowSec) {
      this.logger.warn(
        `Timestamp out of window for runId ${runId}. Now: ${now}, Request: ${timestampNum}, Diff: ${timeDiff}s`,
      );
      throw new UnauthorizedException('Request timestamp is outside acceptable window');
    }

    // Check rawBody availability
    if (!request.rawBody) {
      this.logger.warn(`Missing rawBody for runId ${runId}`);
      throw new UnauthorizedException('Request body is required for signature verification');
    }

    // Compute body hash
    const bodyHash = sha256Hex(request.rawBody);

    // Build signing string
    const signingString = buildSigningString(runId, timestamp, bodyHash);

    // Compute expected signature
    if (!this.secret) {
      this.logger.error('HMAC secret is not configured');
      throw new UnauthorizedException('Server configuration error');
    }

    const expectedSignature = hmacSha256Hex(this.secret, signingString);

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      this.logger.warn(`Signature length mismatch for runId ${runId}`);
      throw new UnauthorizedException('Invalid signature');
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      this.logger.warn(`Invalid signature for runId ${runId}`);
      throw new UnauthorizedException('Invalid signature');
    }

    // Check replay protection
    const replayKey = `agent_cb_replay:v1:${runId}:${signature}`;
    const redisClient = this.redisService.getClient();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (redisClient) {
      const existing = await redisClient.get(replayKey);
      if (existing !== null) {
        this.logger.warn(`Replay attack detected for runId ${runId}, signature ${signature.substring(0, 8)}...`);
        throw new UnauthorizedException('Request replay detected');
      }

      // Set replay key with TTL
      await redisClient.setex(replayKey, this.replayTtlSec, '1');
    } else {
      // In production, Redis is mandatory for replay protection
      if (nodeEnv === 'production') {
        this.logger.error(
          'Redis client not available in production - replay protection is required',
        );
        throw new UnauthorizedException(
          'Server configuration error: Redis is required for replay protection in production',
        );
      }
      // In test/dev mode, Redis might be disabled - log warning but allow
      this.logger.warn('Redis client not available - replay protection disabled');
    }

    this.logger.debug(`HMAC verification passed for runId ${runId}`);
    return true;
  }
}


