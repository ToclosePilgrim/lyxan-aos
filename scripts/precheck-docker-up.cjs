/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function main() {
  const repoRoot = process.cwd();
  const backendEnvPath = path.join(repoRoot, 'backend', '.env');
  const backendEnvExamplePath = path.join(repoRoot, 'backend', '.env.example');

  if (fs.existsSync(backendEnvPath)) {
    return;
  }

  const lines = [
    '',
    'ERROR: Missing required local env file: backend/.env',
    '',
    'Create it by copying the example:',
    '',
    '  PowerShell:',
    '    Copy-Item backend\\.env.example backend\\.env',
    '',
    '  Bash:',
    '    cp backend/.env.example backend/.env',
    '',
    `Expected: ${backendEnvPath}`,
    `Example:   ${backendEnvExamplePath}`,
    '',
  ];

  console.error(lines.join('\n'));
  process.exit(1);
}

main();


