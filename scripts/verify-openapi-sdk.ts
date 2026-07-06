import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(repoRoot, 'packages/kb-sdk/openapi/evukb.openapi.json');
const generatedDir = join(repoRoot, 'packages/kb-sdk/src/generated');

function assertGitPathsClean(pathspec: string[], message: string): void {
  const result = spawnSync('git', ['diff', '--quiet', '--', ...pathspec], {
    cwd: repoRoot,
  });

  if (result.status === 0) {
    return;
  }

  if (result.status === 1) {
    console.error(`${message}\n`);
    spawnSync('git', ['diff', '--stat', '--', ...pathspec], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    throw new Error(message);
  }

  const stderr = result.stderr?.toString().trim();
  throw new Error(stderr ? `git diff failed: ${stderr}` : 'git diff failed.');
}

execSync('pnpm generate-openapi', { cwd: repoRoot, stdio: 'inherit' });
mkdirSync(generatedDir, { recursive: true });
execSync(`pnpm exec openapi-typescript "${specPath}" -o "${join(generatedDir, 'openapi.d.ts')}"`, {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (!existsSync(specPath)) {
  throw new Error(`Expected OpenAPI spec at ${specPath}`);
}

assertGitPathsClean(
  ['packages/kb-sdk/openapi', 'packages/kb-sdk/src/generated'],
  'Run pnpm generate-openapi && pnpm --filter @evu/kb-sdk generate-types and commit.',
);

console.info('OpenAPI spec and generated types are up to date.');
