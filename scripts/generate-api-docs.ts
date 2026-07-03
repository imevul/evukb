import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(repoRoot, 'packages/kb-sdk/openapi/evukb.openapi.json');
const outputDir = join(repoRoot, 'docs/api');
const outputPath = join(outputDir, 'index.html');

execSync('pnpm generate-openapi', { cwd: repoRoot, stdio: 'inherit' });

if (!existsSync(specPath)) {
  throw new Error(`Expected OpenAPI spec at ${specPath}`);
}

mkdirSync(outputDir, { recursive: true });

execSync(
  `pnpm exec redocly build-docs "${specPath}" -o "${outputPath}" --title "EvuKB API Reference"`,
  { cwd: repoRoot, stdio: 'inherit' },
);

if (!existsSync(outputPath)) {
  throw new Error(`Expected API reference HTML at ${outputPath}`);
}

console.info(`Wrote API reference to ${outputPath}`);
