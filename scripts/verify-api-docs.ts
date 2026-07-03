import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repoRoot, 'docs/api/index.html');

execSync('pnpm exec tsx scripts/generate-api-docs.ts', { cwd: repoRoot, stdio: 'inherit' });

if (!existsSync(outputPath)) {
  throw new Error(`Expected API reference HTML at ${outputPath}`);
}

const diff = execSync('git diff -- docs/api/index.html', {
  cwd: repoRoot,
  encoding: 'utf8',
});
if (diff.trim()) {
  console.error('Generated API reference is out of date:\n');
  console.error(diff.slice(0, 2000));
  throw new Error('Run pnpm generate-api-docs and commit docs/api/index.html.');
}

console.info('API reference HTML is up to date.');
