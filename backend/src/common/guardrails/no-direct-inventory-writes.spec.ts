import fs from 'node:fs';
import path from 'node:path';

function walkTsFiles(dir: string, out: string[] = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTsFiles(p, out);
    else if (e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('Guardrail: no direct inventory table writes outside canonical services', () => {
  it('prevents second-path writes to StockMovement/StockBatch/InventoryBalance', () => {
    const srcDir = path.join(__dirname, '..', '..'); // backend/src
    const files = walkTsFiles(srcDir);
    const offenders: Array<{ file: string; match: string }> = [];

    const allowList = new Set<string>([
      // Canonical inventory write path:
      'modules/inventory/fifo.service.ts',
      'modules/inventory/inventory-orchestrator.service.ts',
      // Allow guardrails themselves
      'common/guardrails/no-direct-inventory-writes.spec.ts',
    ]);

    const patterns: Array<{ re: RegExp; name: string }> = [
      {
        re: /\.stockMovement\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
        name: 'stockMovement write',
      },
      {
        re: /\.stockBatch\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
        name: 'stockBatch write',
      },
      {
        re: /\.inventoryBalance\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
        name: 'inventoryBalance write',
      },
    ];

    for (const f of files) {
      const rel = path.relative(srcDir, f).replaceAll('\\', '/');
      if (rel.endsWith('.spec.ts')) continue; // tests can mock/mention
      if (allowList.has(rel)) continue;

      const content = fs.readFileSync(f, 'utf8');
      for (const ptn of patterns) {
        if (ptn.re.test(content)) offenders.push({ file: rel, match: ptn.name });
        ptn.re.lastIndex = 0;
      }
    }

    expect(offenders).toEqual([]);
  });
});


