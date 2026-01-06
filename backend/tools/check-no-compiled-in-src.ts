import fs from 'node:fs';
import path from 'node:path';

type Finding = { file: string; line: number; match: string; rule: string };

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

function normalize(p: string) {
  return p.replace(/\\/g, '/');
}

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function scanFile(file: string, rules: { rule: string; re: RegExp }[]): Finding[] {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const out: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const r of rules) {
      const m = line.match(r.re);
      if (m) {
        out.push({ file, line: i + 1, match: m[0], rule: r.rule });
      }
    }
  }
  return out;
}

function fail(findings: Finding[]) {
  // eslint-disable-next-line no-console
  console.error('\nNO-COMPILED-IN-SRC CHECK FAILED\n');
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }
  for (const [file, items] of byFile.entries()) {
    // eslint-disable-next-line no-console
    console.error(`- ${normalize(path.relative(REPO_ROOT, file))}`);
    for (const it of items) {
      // eslint-disable-next-line no-console
      console.error(`  L${it.line}: [${it.rule}] ${it.match}`);
    }
  }
  // eslint-disable-next-line no-console
  console.error('\nFix: purge compiled artifacts from backend/src/**/*.ts (use real TS sources).\n');
  process.exit(1);
}

function main() {
  const rules = [
    { rule: 'compiled:decorate', re: /\bvar\s+__decorate\b/ },
    { rule: 'compiled:metadata', re: /\bvar\s+__metadata\b/ },
    { rule: 'compiled:define-esmodule', re: /Object\.defineProperty\(exports,\s*["']__esModule["']/ },
    { rule: 'compiled:exports-dot', re: /^\s*exports\./ },
    { rule: 'compiled:module-exports', re: /\bmodule\.exports\b/ },
    // "use strict" itself is fine, but together with exports.* usually signals CJS output.
    { rule: 'compiled:use-strict', re: /^\s*["']use strict["'];\s*$/ },
    // Heuristic: require() for common libs is OK in rare cases, but in combination with the above markers it’s compiled output.
    { rule: 'compiled:require', re: /\brequire\(["'](@nestjs|@prisma|rxjs|reflect-metadata|node:|\.{1,2}\/)/ },
  ];

  const findings: Finding[] = [];
  for (const file of walk(SRC_ROOT)) {
    if (!file.endsWith('.ts')) continue;
    if (file.endsWith('.d.ts')) continue;
    const hits = scanFile(file, rules);
    if (!hits.length) continue;

    // Only fail if the file has at least one strong compiled marker (decorate/metadata/exports/module.exports/defineProperty)
    // This prevents false positives on legitimate require() usage.
    const strong = hits.filter((h) =>
      new Set([
        'compiled:decorate',
        'compiled:metadata',
        'compiled:define-esmodule',
        'compiled:exports-dot',
        'compiled:module-exports',
      ]).has(h.rule),
    );
    if (strong.length) {
      findings.push(...hits);
    }
  }

  if (findings.length) fail(findings);
  // eslint-disable-next-line no-console
  console.log('OK: no compiled artifacts detected in backend/src/**/*.ts');
}

main();






