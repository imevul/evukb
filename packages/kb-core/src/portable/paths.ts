import { normalizeRelativePath } from '../storage/path-safety.js';
import { portableFilesPrefix, portableManifestPath } from './types.js';

export function normalizePortableZipEntry(entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0) {
    throw new Error('Empty zip entry path.');
  }

  if (normalized === portableManifestPath) {
    return normalized;
  }

  const segments = normalized.split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '..') {
      throw new Error(`Unsafe zip entry path: ${entryName}`);
    }
    if (segment === '.evukb') {
      throw new Error(`Blocked zip entry segment: ${segment}`);
    }
  }

  if (normalized.startsWith('/')) {
    throw new Error(`Absolute zip entry path: ${entryName}`);
  }

  return normalized;
}

export function assertPortableFileEntry(entryName: string): string {
  const normalized = normalizePortableZipEntry(entryName);
  if (!normalized.startsWith(portableFilesPrefix)) {
    throw new Error(`Zip entry is outside files/: ${entryName}`);
  }
  const relativePath = normalized.slice(portableFilesPrefix.length);
  if (relativePath.length === 0) {
    throw new Error(`Zip entry missing file path under files/: ${entryName}`);
  }
  return normalizeRelativePath(relativePath);
}

export function isPortableManifestEntry(entryName: string): boolean {
  try {
    return normalizePortableZipEntry(entryName) === portableManifestPath;
  } catch {
    return false;
  }
}
