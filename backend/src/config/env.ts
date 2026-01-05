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
  };

  cached = env;
  return env;
}

