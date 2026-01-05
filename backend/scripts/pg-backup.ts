import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

function loadEnv() {
  // Best-effort local env loading (repo may block committing .env files, but local files can exist)
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

function formatTimestamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}`;
}

function bytesToMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function ensurePgToolExists(bin: string) {
  resolvePgBin(bin); // throws with a helpful message if not found
}

function resolvePgBin(bin: string): string {
  const isWin = process.platform === 'win32';
  const exe = isWin ? `${bin}.exe` : bin;

  // 1) Explicit override
  const pgBin = process.env.PG_BIN;
  if (pgBin) {
    const candidate = path.join(pgBin, exe);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 2) PATH lookup
  const probe = spawnSync(exe, ['--version'], { stdio: 'pipe' });
  if (!probe.error) return exe;

  // 3) Windows common install paths
  if (isWin) {
    const roots = ['C:\\\\Program Files\\\\PostgreSQL', 'C:\\\\Program Files (x86)\\\\PostgreSQL'];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const entries = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
      // Prefer highest version folder (string sort is good enough for 14/15/16)
      entries.sort((a, b) => (a.name < b.name ? 1 : -1));
      for (const d of entries) {
        const candidate = path.join(root, d.name, 'bin', exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  throw new Error(
    `${bin} not found. Install PostgreSQL client tools and ensure "${exe}" is in PATH.\n` +
      `You can also set PG_BIN to the Postgres bin directory (e.g. "C:\\\\Program Files\\\\PostgreSQL\\\\15\\\\bin").\n` +
      `On macOS: brew install postgresql@15\n` +
      `On Ubuntu: sudo apt-get install postgresql-client`,
  );
}

async function main() {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pgDump = resolvePgBin('pg_dump');

  const backupsDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const startedAt = Date.now();
  const filename = `aos-backup-${formatTimestamp(new Date())}.dump`;
  const outPath = path.join(backupsDir, filename);

  const args = [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file',
    outPath,
    databaseUrl,
  ];

  console.log(`🗄️  Starting backup...`);
  console.log(`- DATABASE_URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`- Output: ${path.relative(process.cwd(), outPath)}`);

  const res = spawnSync(pgDump, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`pg_dump failed with exit code ${res.status ?? 'unknown'}`);
  }

  const stat = fs.statSync(outPath);
  const durationMs = Date.now() - startedAt;
  console.log(`✅ Backup completed: ${filename}`);
  console.log(`- Size: ${bytesToMb(stat.size)} MB`);
  console.log(`- Time: ${durationMs} ms`);
}

main().catch((err) => {
  console.error('❌ Backup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});


