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

describe('Guardrail: ScmStock must not be used in backend source', () => {
  it('contains no ScmStock/scmStock references in src/**', () => {
    const srcDir = path.join(__dirname, '..', '..'); // backend/src
    const files = walkTsFiles(srcDir);
    const offenders: Array<{ file: string; match: string }> = [];

    // We intentionally do NOT ban the word "ScmStock" in comments/strings (docs, deprecation messages).
    // We ban:
    // - Prisma client usage: `.scmStock`
    // - Importing the ScmStock type/model from @prisma/client
    const patterns: Array<{ re: RegExp; name: string }> = [
      { re: /\.scmStock\b/g, name: '.scmStock prisma accessor' },
      {
        // Match only actual import clauses that include ScmStock.
        // Avoid spanning the whole file (comments/strings may mention "ScmStock" for deprecation messaging).
        re: /import\s+(type\s+)?\{[^}]*\bScmStock\b[^}]*\}\s+from\s+['"]@prisma\/client['"]/g,
        name: 'ScmStock imported from @prisma/client',
      },
    ];

    for (const f of files) {
      const rel = path.relative(srcDir, f).replaceAll('\\', '/');
      // Allow harmless mentions in guardrail itself.
      if (rel.endsWith('common/guardrails/no-scmstock.spec.ts')) continue;

      const content = fs.readFileSync(f, 'utf8');
      for (const p of patterns) {
        if (p.re.test(content)) {
          offenders.push({ file: rel, match: p.name });
        }
        p.re.lastIndex = 0;
      }
    }

    expect(offenders).toEqual([]);
  });
});


