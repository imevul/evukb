import { portableManifestPath } from '../portable/types.js';
import { normalizeRelativePath } from '../storage/path-safety.js';

/** Path segments removed automatically during archive import (never imported into a corpus). */
export const autostrippedArchiveZipSegments = ['.git'] as const;

export function shouldAutostripArchiveZipEntry(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  return segments.some((segment) =>
    (autostrippedArchiveZipSegments as readonly string[]).includes(segment),
  );
}

export function stripAutostrippedZipEntries(entries: Record<string, Uint8Array>): {
  entries: Record<string, Uint8Array>;
  autostrippedCount: number;
} {
  const kept: Record<string, Uint8Array> = {};
  let autostrippedCount = 0;

  for (const [entryName, body] of Object.entries(entries)) {
    if (shouldAutostripArchiveZipEntry(entryName)) {
      autostrippedCount += 1;
      continue;
    }
    kept[entryName] = body;
  }

  return { entries: kept, autostrippedCount };
}

export function buildAutostrippedArchiveWarning(autostrippedCount: number): string {
  const entryLabel = autostrippedCount === 1 ? 'entry' : 'entries';
  return `Skipped ${autostrippedCount} archive ${entryLabel} under autostripped paths (${autostrippedArchiveZipSegments.join(', ')}).`;
}

export function normalizeArchiveZipEntry(entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0) {
    throw new Error('Empty zip entry path.');
  }

  const segments = normalized.split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '..') {
      throw new Error(`Unsafe zip entry path: ${entryName}`);
    }
  }

  if (normalized.startsWith('/')) {
    throw new Error(`Absolute zip entry path: ${entryName}`);
  }

  return normalizeRelativePath(normalized);
}

export function isPortableArchive(entries: ReadonlyMap<string, Uint8Array>): boolean {
  return entries.has(portableManifestPath);
}

export function archiveSourceRef(relativePath: string): string {
  return `archive:${relativePath}`;
}
