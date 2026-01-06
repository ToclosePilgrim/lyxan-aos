import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

export type Env = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL?: string;
  JWT_SECRET: string;
  VERSION?: string;
  ACCOUNTING_VALIDATE_ON_POST?: 'true' | 'false';
  LEGACY_STOCK_ENABLED?: 'true' | 'false';
  OS_SELF_VALIDATE_MODE?: 'strict' | 'warn' | 'off';
  AGENT_CALLBACK_HMAC_SECRET?: string;
  AGENT_CALLBACK_HMAC_WINDOW_SEC?: number;
  AGENT_CALLBACK_REPLAY_TTL_SEC?: number;
  IDEMPOTENCY_TTL_SEC?: number;
  IDEMPOTENCY_REQUIRED_IN_PROD?: string;
  AGENT_DISPATCH_QUEUE_CONCURRENCY?: number;
  AGENT_DISPATCH_ATTEMPTS?: number;
  AGENT_DISPATCH_BACKOFF_BASE_MS?: number;
  AGENT_DISPATCH_WORKER_ENABLED?: string;
  N8N_HTTP_TIMEOUT_MS?: number;
  N8N_DISPATCH_SECRET?: string;
};

let cached: Env | null = null;

function loadEnvFiles() {
  // Keep consistent with ConfigModule envFilePath: ['.env', '../.env']
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
}

function parseIntOrDefault(raw: string | undefined, def: number): number {
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

export function validateEnvOrThrow(): Env {
  if (cached) return cached;

  loadEnvFiles();

  const missing: string[] = [];

  const NODE_ENV = process.env.NODE_ENV ?? 'development';
  const PORT = parseIntOrDefault(process.env.PORT, 3001);

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) missing.push('DATABASE_URL');

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) missing.push('JWT_SECRET');

  // AGENT_CALLBACK_HMAC_SECRET is required in production
  const AGENT_CALLBACK_HMAC_SECRET = process.env.AGENT_CALLBACK_HMAC_SECRET;
  if (NODE_ENV === 'production' && !AGENT_CALLBACK_HMAC_SECRET) {
    missing.push('AGENT_CALLBACK_HMAC_SECRET');
  }

  if (missing.length > 0) {
    const msg =
      `Missing required environment variables:\n` +
      missing.map((m) => `- ${m}`).join('\n') +
      `\n\nCreate env file from template: backend/.env.example`;
    // Fail-fast with a clear error (DoD requirement)
    throw new Error(msg);
  }

  const env: Env = {
    NODE_ENV,
    PORT,
    DATABASE_URL: DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: JWT_SECRET!,
    VERSION:
      process.env.VERSION ?? process.env.GIT_SHA ?? process.env.GITHUB_SHA,
    ACCOUNTING_VALIDATE_ON_POST: process.env.ACCOUNTING_VALIDATE_ON_POST as any,
    LEGACY_STOCK_ENABLED: process.env.LEGACY_STOCK_ENABLED as any,
    OS_SELF_VALIDATE_MODE: process.env.OS_SELF_VALIDATE_MODE as any,
    AGENT_CALLBACK_HMAC_SECRET: process.env.AGENT_CALLBACK_HMAC_SECRET,
    AGENT_CALLBACK_HMAC_WINDOW_SEC: parseIntOrDefault(
      process.env.AGENT_CALLBACK_HMAC_WINDOW_SEC,
      300,
    ),
    AGENT_CALLBACK_REPLAY_TTL_SEC: parseIntOrDefault(
      process.env.AGENT_CALLBACK_REPLAY_TTL_SEC,
      600,
    ),
    IDEMPOTENCY_TTL_SEC: parseIntOrDefault(
      process.env.IDEMPOTENCY_TTL_SEC,
      86400, // 24 hours
    ),
    IDEMPOTENCY_REQUIRED_IN_PROD: process.env.IDEMPOTENCY_REQUIRED_IN_PROD,
    AGENT_DISPATCH_QUEUE_CONCURRENCY: parseIntOrDefault(
      process.env.AGENT_DISPATCH_QUEUE_CONCURRENCY,
      5,
    ),
    AGENT_DISPATCH_ATTEMPTS: parseIntOrDefault(
      process.env.AGENT_DISPATCH_ATTEMPTS,
      5,
    ),
    AGENT_DISPATCH_BACKOFF_BASE_MS: parseIntOrDefault(
      process.env.AGENT_DISPATCH_BACKOFF_BASE_MS,
      5000,
    ),
    AGENT_DISPATCH_WORKER_ENABLED: process.env.AGENT_DISPATCH_WORKER_ENABLED,
    N8N_HTTP_TIMEOUT_MS: parseIntOrDefault(process.env.N8N_HTTP_TIMEOUT_MS, 15000),
    N8N_DISPATCH_SECRET: process.env.N8N_DISPATCH_SECRET,
  };

  cached = env;
  return env;
}

