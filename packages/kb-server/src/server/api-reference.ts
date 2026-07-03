import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Candidate paths for the bundled Redoc HTML (repo root vs Docker image). */
export function resolveApiReferenceHtmlPath(): string | null {
  const candidates = [
    join(process.cwd(), 'docs/api/index.html'),
    join(moduleDir, '../../../../docs/api/index.html'),
    join(moduleDir, '../../../docs/api/index.html'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function readApiReferenceHtml(): string | null {
  const path = resolveApiReferenceHtmlPath();
  if (!path) {
    return null;
  }
  return readFileSync(path, 'utf8');
}
