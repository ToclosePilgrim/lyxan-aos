import fs from 'node:fs';
import path from 'node:path';

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`OK: ${msg}`);
}

const appModulePath = path.join(__dirname, '..', 'src', 'app.module.ts');
const mainPath = path.join(__dirname, '..', 'src', 'main.ts');

const appModule = fs.readFileSync(appModulePath, 'utf8');
const main = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';

if (appModule.includes('TestSeedModule') || appModule.includes('devtools/test-seed')) {
  fail('`TestSeedModule` must NOT be imported from `src/app.module.ts` (devtools must not be wired by default).');
}
if (main.includes('TestSeedModule') || main.includes('devtools/test-seed')) {
  fail('`TestSeedModule` must NOT be imported from `src/main.ts`.');
}

const guardPath = path.join(__dirname, '..', 'src', 'modules', 'devtools', 'test-seed', 'test-seed.guard.ts');
const guard = fs.readFileSync(guardPath, 'utf8');
if (!guard.includes('ENABLE_TEST_SEED_API')) {
  fail('`TestSeedGuard` must gate endpoint behind ENABLE_TEST_SEED_API.');
}
if (!guard.includes("NODE_ENV") || !guard.includes('production')) {
  fail('`TestSeedGuard` must also block in production NODE_ENV.');
}

ok('TestSeedModule is not wired in AppModule/main, and guard gates by env.');



