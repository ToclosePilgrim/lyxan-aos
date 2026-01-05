import * as fs from 'fs';
import * as path from 'path';

type Finding = {
  file: string;
  line: number;
  match: string;
  rule: string;
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
const SRC_ROOT = path.join(BACKEND_ROOT, 'src');
const SCHEMA_PATH = path.join(BACKEND_ROOT, 'prisma', 'schema.prisma');

function normalize(p: string) {
  return p.replace(/\\/g, '/');
}

function isIgnored(filePath: string) {
  const p = normalize(filePath);
  return (
    p.includes('/node_modules/') ||
    p.includes('/dist/') ||
    p.includes('/coverage/') ||
    p.includes('/.git/') ||
    p.includes('/docs/') ||
    p.includes('/backend/test/') ||
    p.includes('/backend/prisma/migrations/')
  );
}

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isIgnored(full)) continue;
    if (e.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function scanFile(file: string, rules: { rule: string; re: RegExp }[]): Finding[] {
  const out: Finding[] = [];
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
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
  console.error('\nARCHITECTURE LOCKDOWN FAILED\n');
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
  console.error('\nFix the forbidden patterns above, or update ADR via an explicit Architecture Change Request.\n');
  process.exit(1);
}

function scanSchemaGuards(): Finding[] {
  const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const findings: Finding[] = [];

  // 1) Hard ban: model Supplier
  const modelSupplier = raw.match(/^\s*model\s+Supplier\b/m);
  if (modelSupplier) {
    const idx = raw.slice(0, modelSupplier.index ?? 0).split(/\r?\n/).length;
    findings.push({
      file: SCHEMA_PATH,
      line: idx,
      match: modelSupplier[0],
      rule: 'prisma:model-supplier-forbidden',
    });
  }

  // 2) Hard ban: SCM suppliers table/model names
  const scmSuppliers = raw.match(/scm_suppliers/m);
  if (scmSuppliers) {
    const idx = raw.slice(0, scmSuppliers.index ?? 0).split(/\r?\n/).length;
    findings.push({
      file: SCHEMA_PATH,
      line: idx,
      match: 'scm_suppliers',
      rule: 'prisma:scm-suppliers-forbidden',
    });
  }

  // 3) SCM model field guard: supplierId forbidden, supplierCounterpartyId required.
  function checkModelBlock(modelName: string) {
    const re = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
    const m = raw.match(re);
    if (!m) return;
    const block = m[1];
    const hasSupplierId = /\bsupplierId\b/.test(block);
    const hasSupplierCounterpartyId = /\bsupplierCounterpartyId\b/.test(block);
    if (hasSupplierId) {
      const hit = block.match(/\bsupplierId\b/);
      const idx =
        raw.slice(0, (m.index ?? 0) + (hit?.index ?? 0)).split(/\r?\n/).length + 1;
      findings.push({
        file: SCHEMA_PATH,
        line: idx,
        match: 'supplierId',
        rule: `prisma:${modelName}:supplierId-forbidden`,
      });
    }
    if (!hasSupplierCounterpartyId) {
      const idx = raw.slice(0, m.index ?? 0).split(/\r?\n/).length;
      findings.push({
        file: SCHEMA_PATH,
        line: idx,
        match: `${modelName} missing supplierCounterpartyId`,
        rule: `prisma:${modelName}:supplierCounterpartyId-required`,
      });
    }
  }

  checkModelBlock('ScmSupply');

  return findings;
}

function main() {
  const findings: Finding[] = [];

  // Directory hard-ban: SCM suppliers module must not exist.
  const scmSuppliersDir = path.join(SRC_ROOT, 'modules', 'scm', 'suppliers');
  if (fs.existsSync(scmSuppliersDir)) {
    findings.push({
      file: scmSuppliersDir,
      line: 1,
      match: normalize(path.relative(REPO_ROOT, scmSuppliersDir)),
      rule: 'scm:suppliers-module-forbidden',
    });
  }

  // Runtime code scan
  const runtimeRules = [
    { rule: 'runtime:scm-suppliers-route-forbidden', re: /['"`]scm\/suppliers\b/ },
    { rule: 'runtime:api-scm-suppliers-route-forbidden', re: /\/api\/scm\/suppliers\b/ },
    { rule: 'runtime:SuppliersController-forbidden', re: /\bSuppliersController\b/ },
    { rule: 'runtime:SuppliersService-forbidden', re: /\bSuppliersService\b/ },
    // In SCM code specifically: supplierId should not be used (only supplierCounterpartyId)
  ];

  for (const file of walk(SRC_ROOT)) {
    const ext = path.extname(file);
    if (ext !== '.ts') continue;
    findings.push(...scanFile(file, runtimeRules));
  }

  // NOTE: We enforce "no SCM supplierId" at the Prisma level (schema guards).
  // Runtime code may legitimately reference finance fields named supplierId
  // (e.g., FinancialDocument.supplierId), so we intentionally do NOT forbid
  // the token "supplierId" across all SCM code.

  findings.push(...scanSchemaGuards());

  if (findings.length) fail(findings);
  // eslint-disable-next-line no-console
  console.log('Architecture lockdown check passed.');
}

main();


