import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

type PackageManifest = {
  name: string;
  exports?: Record<string, unknown>;
};

function readPackageManifest(relativePath: string): PackageManifest {
  const raw = readFileSync(join(repoRoot, relativePath), 'utf8');
  return JSON.parse(raw) as PackageManifest;
}

function exportKeys(manifest: PackageManifest): string[] {
  return Object.keys(manifest.exports ?? {});
}

/**
 * Documented supported surfaces — keep in sync with docs/PACKAGES.md.
 */
const documentedSurfaces: Record<string, string[]> = {
  '@evu/kb-core': ['.', './okf/browser', './archive/heuristics'],
  '@evu/kb-db': ['.', './migrate', './schema'],
  '@evu/kb-server': ['.'],
  '@evu/kb-sdk': ['.'],
  '@evu/kb-ui': ['.', './theme/tokens.css', './theme/components.css'],
};

describe('package surface contract', () => {
  for (const [packageName, expectedExports] of Object.entries(documentedSurfaces)) {
    const folder = packageName.replace('@evu/', 'packages/');
    const manifestPath = `${folder}/package.json`;

    it(`${packageName} exports match docs/PACKAGES.md`, () => {
      const manifest = readPackageManifest(manifestPath);
      expect(manifest.name).toBe(packageName);
      expect(exportKeys(manifest)).toEqual(expectedExports);
    });
  }
});
