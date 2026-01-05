import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as dotenv from 'dotenv';

function loadEnv() {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

function ensurePgToolExists(bin: string) {
  resolvePgBin(bin); // throws if not found
}

function resolvePgBin(bin: string): string {
  const isWin = process.platform === 'win32';
  const exe = isWin ? `${bin}.exe` : bin;

  const pgBin = process.env.PG_BIN;
  if (pgBin) {
    const candidate = path.join(pgBin, exe);
    if (fs.existsSync(candidate)) return candidate;
  }

  const probe = spawnSync(exe, ['--version'], { stdio: 'pipe' });
  if (!probe.error) return exe;

  if (isWin) {
    const roots = ['C:\\\\Program Files\\\\PostgreSQL', 'C:\\\\Program Files (x86)\\\\PostgreSQL'];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const entries = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
      entries.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const d of entries) {
        const candidate = path.join(root, d.name, 'bin', exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  throw new Error(
    `${bin} not found. Install PostgreSQL client tools and ensure "${exe}" is in PATH.\n` +
      `You can also set PG_BIN to the Postgres bin directory (e.g. "C:\\\\Program Files\\\\PostgreSQL\\\\15\\\\bin").`,
  );
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const positionals: string[] = [];
  for (const a of argv) {
    if (a.startsWith('-')) flags.add(a);
    else positionals.push(a);
  }
  return { flags, positionals };
}

function parseHostFromDatabaseUrl(databaseUrl: string): string | null {
  try {
    const u = new URL(databaseUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

function tryGetTableCount(databaseUrl: string): number | null {
  // Best effort: if psql exists, check if there are any user tables in public schema
  let psqlBin: string;
  try {
    psqlBin = resolvePgBin('psql');
  } catch {
    return null;
  }

  const sql =
    "select count(*)::int from information_schema.tables where table_schema='public' and table_type='BASE TABLE';";
  const res = spawnSync(psqlBin, [databaseUrl, '-tA', '-c', sql], { stdio: 'pipe' });
  if (res.status !== 0) return null;
  const out = (res.stdout ?? Buffer.from('')).toString('utf8').trim();
  const n = Number(out);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  loadEnv();

  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const force = flags.has('--force');
  const yes = flags.has('--yes') || flags.has('-y');

  if (isProd && !force) {
    throw new Error('Refusing to restore in production without --force (NODE_ENV=production).');
  }

  const dumpPathArg = positionals[0];
  if (!dumpPathArg) {
    throw new Error(
      'Usage: pnpm --filter backend db:restore -- <path-to-dump>\n' +
        'Example: pnpm --filter backend db:restore -- backups/aos-backup-20251213-1200.dump',
    );
  }

  const dumpPath = path.isAbsolute(dumpPathArg)
    ? dumpPathArg
    : path.join(process.cwd(), dumpPathArg);

  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found: ${dumpPath}`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const host = parseHostFromDatabaseUrl(databaseUrl);
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (host && !isLocalHost) {
    console.warn(`⚠️  WARNING: DATABASE_URL host is not localhost (${host}).`);
  }

  const pgRestore = resolvePgBin('pg_restore');

  const tableCount = tryGetTableCount(databaseUrl);
  if (tableCount === null) {
    console.warn('⚠️  Could not determine whether DB is empty (psql not available).');
  }

  const needsConfirm = tableCount === null ? true : tableCount > 0;

  if (needsConfirm && !yes) {
    console.log(`Dump: ${dumpPath}`);
    console.log(`Target: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
    if (tableCount !== null) {
      console.log(`Detected public tables: ${tableCount}`);
    }
    const ok = await promptYesNo('This will overwrite existing data. Continue? (yes/no) ');
    if (!ok) {
      console.log('Restore cancelled.');
      return;
    }
  }

  const startedAt = Date.now();
  console.log('♻️  Starting restore...');

  const args = [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--dbname',
    databaseUrl,
    dumpPath,
  ];

  const res = spawnSync(pgRestore, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`pg_restore failed with exit code ${res.status ?? 'unknown'}`);
  }

  const durationMs = Date.now() - startedAt;
  console.log(`✅ Restore completed in ${durationMs} ms`);
}

main().catch((err) => {
  console.error('❌ Restore failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});


