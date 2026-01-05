import fs from 'node:fs';
import path from 'node:path';

type Finding = { file: string; line: number; text: string; kind: string };

function parseArgs(argv: string[]) {
  const args = {
    strict: true,
    allowlist: new Set<string>(),
    allowlistFile: undefined as string | undefined,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') args.strict = true;
    if (a === '--allowlist') {
      const p = argv[i + 1];
      if (!p) throw new Error('--allowlist requires a path');
      args.allowlist.add(path.normalize(p));
      i++;
    }
    if (a === '--allowlist-file') {
      const p = argv[i + 1];
      if (!p) throw new Error('--allowlist-file requires a path');
      args.allowlistFile = path.normalize(p);
      i++;
    }
  }
  return args;
}

function listFiles(root: string) {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function isTarget(file: string) {
  const norm = file.replace(/\\/g, '/');
  if (!norm.includes('/backend/test/')) return false;
  return (
    norm.endsWith('.e2e-spec.ts') ||
    /\/e2e-.*\.ts$/.test(norm)
  );
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = process.cwd(); // backend/
  const testRoot = path.join(repoRoot, 'test');

  const allow = new Set<string>();
  for (const p of args.allowlist) {
    allow.add(path.normalize(path.isAbsolute(p) ? p : path.join(repoRoot, p)));
  }
  if (args.allowlistFile) {
    const abs = path.normalize(
      path.isAbsolute(args.allowlistFile)
        ? args.allowlistFile
        : path.join(repoRoot, args.allowlistFile),
    );
    const raw = fs.readFileSync(abs, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      allow.add(path.normalize(path.isAbsolute(t) ? t : path.join(repoRoot, t)));
    }
  }

  const files = listFiles(testRoot).filter(isTarget);

  const findings: Finding[] = [];

  // Flag writes, not reads.
  const writeMethods = [
    'createMany',
    'create',
    'updateMany',
    'update',
    'deleteMany',
    'delete',
    'upsert',
    '\\$executeRaw',
    '\\$queryRaw',
    'executeRaw',
    'queryRaw',
  ];

  const writeRe = new RegExp(
    // allow "(prisma as any)" or "prisma" or "prismaClient" variable named prisma
    String.raw`(^|[^\w])prisma[\w\s\)\(\.\?\:]*\.(?:${writeMethods.join('|')})\s*\(`,
  );

  for (const f of files) {
    const abs = path.normalize(f);
    if (allow.has(abs)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('prisma')) continue;
      if (writeRe.test(line)) {
        const m = line.match(/\.(\$\w+|\w+)\s*\(/);
        findings.push({
          file: path.relative(repoRoot, f),
          line: i + 1,
          text: line.trim(),
          kind: m?.[1] ?? 'write',
        });
      }
    }
  }

  if (findings.length === 0) {
    // eslint-disable-next-line no-console
    console.log('OK: no Prisma writes detected in e2e tests.');
    return;
  }

  const byFile = new Map<string, Finding[]>();
  for (const fd of findings) {
    const arr = byFile.get(fd.file) ?? [];
    arr.push(fd);
    byFile.set(fd.file, arr);
  }

  // eslint-disable-next-line no-console
  console.error(`Found ${findings.length} Prisma-write hits across ${byFile.size} file(s).`);
  for (const [file, items] of byFile.entries()) {
    // eslint-disable-next-line no-console
    console.error(`\n${file}`);
    for (const it of items) {
      // eslint-disable-next-line no-console
      console.error(`  L${it.line}: ${it.kind} :: ${it.text}`);
    }
  }

  process.exitCode = 1;
}

main();


