import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(repoRoot, 'packages/kb-sdk/openapi/evukb.openapi.json');
const generatedDir = join(repoRoot, 'packages/kb-sdk/src/generated');

execSync('pnpm generate-openapi', { cwd: repoRoot, stdio: 'inherit' });
mkdirSync(generatedDir, { recursive: true });
execSync(`pnpm exec openapi-typescript "${specPath}" -o "${join(generatedDir, 'openapi.d.ts')}"`, {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (!existsSync(specPath)) {
  throw new Error(`Expected OpenAPI spec at ${specPath}`);
}

const diff = execSync('git diff -- packages/kb-sdk/openapi packages/kb-sdk/src/generated', {
  cwd: repoRoot,
  encoding: 'utf8',
});
if (diff.trim()) {
  console.error('OpenAPI or generated SDK types are out of date:\n');
  console.error(diff);
  throw new Error(
    'Run pnpm generate-openapi && pnpm --filter @evu/kb-sdk generate-types and commit.',
  );
}

console.info('OpenAPI spec and generated types are up to date.');
