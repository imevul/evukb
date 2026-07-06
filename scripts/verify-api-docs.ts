import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repoRoot, 'docs/api/index.html');

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

execSync('pnpm exec tsx scripts/generate-api-docs.ts', { cwd: repoRoot, stdio: 'inherit' });

if (!existsSync(outputPath)) {
  throw new Error(`Expected API reference HTML at ${outputPath}`);
}

assertGitPathsClean(
  ['docs/api/index.html'],
  'Run pnpm generate-api-docs and commit docs/api/index.html.',
);

console.info('API reference HTML is up to date.');
