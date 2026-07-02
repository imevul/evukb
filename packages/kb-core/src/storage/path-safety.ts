import path from 'node:path';

import type { CorpusId, WorkspaceId } from '../ids.js';
import { asCorpusId, asWorkspaceId } from '../ids.js';
import type { BlobRef } from './adapters.js';

const unsafePathPattern = /(?:^|[/\\])\.\.(?:[/\\]|$)/;

export function normalizeRelativePath(input: string): string {
  const normalized = path.posix.normalize(input.replace(/\\/g, '/'));
  if (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    unsafePathPattern.test(normalized)
  ) {
    throw new Error(`Unsafe relative path: ${input}`);
  }
  return normalized;
}

export function createBlobRef(
  workspaceId: WorkspaceId,
  corpusId: CorpusId,
  relPath: string,
): BlobRef {
  return {
    workspaceId,
    corpusId,
    relPath: normalizeRelativePath(relPath),
  };
}

export function blobRefToStorageKey(ref: BlobRef): string {
  const workspaceSegment = normalizeRelativePath(ref.workspaceId);
  const corpusSegment = normalizeRelativePath(ref.corpusId);
  const fileSegment = normalizeRelativePath(ref.relPath);
  return path.posix.join(workspaceSegment, corpusSegment, fileSegment);
}

export function resolveBlobAbsolutePath(rootDir: string, ref: BlobRef): string {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, blobRefToStorageKey(ref));
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Resolved blob path escapes the configured blob root.');
  }
  return absolute;
}

export function parseBlobRefFromStorageKey(rootDir: string, absolutePath: string): BlobRef | null {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(absolutePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  const relative = path.relative(root, resolved).replace(/\\/g, '/');
  const segments = relative.split('/').filter(Boolean);
  if (segments.length < 3) {
    return null;
  }
  const [workspaceId, corpusId, ...rest] = segments;
  return createBlobRef(
    asWorkspaceId(workspaceId ?? ''),
    asCorpusId(corpusId ?? ''),
    rest.join('/'),
  );
}
