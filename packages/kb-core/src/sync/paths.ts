import path from 'node:path';

import { normalizeRelativePath } from '../storage/path-safety.js';

export function parseMountAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

export function isPathWithinRoot(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

export function resolveAllowedMountPath(
  mountPath: string,
  allowlist: string[],
): { resolved: string } | { error: string } {
  if (allowlist.length === 0) {
    return { error: 'Mount sync is disabled: EVUKB_MOUNT_ALLOWLIST is not configured.' };
  }

  let normalized: string;
  try {
    normalized = path.resolve(mountPath);
  } catch {
    return { error: `Invalid mount path: ${mountPath}` };
  }

  const allowed = allowlist.some((root) => isPathWithinRoot(root, normalized));
  if (!allowed) {
    return { error: `Mount path is not under an allowed root: ${mountPath}` };
  }

  return { resolved: normalized };
}

export function splitRelativeFilePath(relativePath: string): { parentPath: string; name: string } {
  const normalized = normalizeRelativePath(relativePath.replace(/\\/g, '/'));
  const segments = normalized.split('/');
  const name = segments.pop();
  if (!name) {
    throw new Error(`Invalid relative file path: ${relativePath}`);
  }
  return {
    parentPath: segments.join('/'),
    name,
  };
}

export function guessMimeType(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md')) {
    return 'text/markdown';
  }
  if (lower.endsWith('.txt')) {
    return 'text/plain';
  }
  if (lower.endsWith('.json')) {
    return 'application/json';
  }
  return null;
}
