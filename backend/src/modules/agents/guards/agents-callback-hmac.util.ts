import crypto from 'crypto';

/**
 * Compute SHA256 hash of buffer and return as hex string
 */
export function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Compute HMAC-SHA256 of data with secret and return as hex string
 */
export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Build signing string for agent callback HMAC verification
 * Format: agents_callback.v1\n<runId>\n<timestamp>\n<bodyHash>
 */
export function buildSigningString(
  runId: string,
  timestamp: string,
  bodyHash: string,
): string {
  return ['agents_callback.v1', runId, timestamp, bodyHash].join('\n');
}




