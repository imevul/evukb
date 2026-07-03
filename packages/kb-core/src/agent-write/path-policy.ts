import { normalizeRelativePath } from '../storage/path-safety.js';
import { agentNotesRoot } from './types.js';

export class AgentWritePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentWritePathError';
  }
}

export type AgentWritePathLayers = {
  workspacePrefixes?: string[];
  corpusPrefixes?: string[];
  tokenPrefixes?: string[];
};

const maxAgentWritePathPrefixes = 16;

export function defaultAgentWritePathPrefixes(): string[] {
  return [agentNotesRoot];
}

export function normalizeAgentWritePath(input: string): string {
  const trimmed = input.trim().replace(/^\/+/, '');
  if (!trimmed) {
    throw new AgentWritePathError('Path is required.');
  }
  try {
    return normalizeRelativePath(trimmed);
  } catch {
    throw new AgentWritePathError(`Unsafe relative path: ${input}`);
  }
}

export function normalizeAgentWritePrefix(input: string): string {
  return normalizeAgentWritePath(input).replace(/\/+$/, '');
}

export function prefixCovers(prefix: string, path: string): boolean {
  const normalizedPrefix = normalizeAgentWritePrefix(prefix);
  const normalizedPath = normalizeAgentWritePath(path);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

export function parseAgentWritePathPrefixes(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const prefixes: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) {
      return undefined;
    }
    prefixes.push(normalizeAgentWritePrefix(item));
  }
  return prefixes.length > 0 ? [...new Set(prefixes)] : undefined;
}

export function validateAgentWritePathPrefixes(
  raw: unknown,
  label = 'settings.agentWritePathPrefixes',
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return `${label} must be an array.`;
  }
  if (raw.length === 0) {
    return `${label} must contain at least one prefix when set.`;
  }
  if (raw.length > maxAgentWritePathPrefixes) {
    return `${label} must contain at most ${maxAgentWritePathPrefixes} entries.`;
  }
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) {
      return `${label} entries must be non-empty strings.`;
    }
    try {
      normalizeAgentWritePrefix(item);
    } catch {
      return `${label} contains an unsafe path prefix.`;
    }
  }
  return null;
}

export function workspaceAgentWritePathPrefixes(
  workspaceSettings: Record<string, unknown>,
): string[] {
  return (
    parseAgentWritePathPrefixes(workspaceSettings.agentWritePathPrefixes) ??
    defaultAgentWritePathPrefixes()
  );
}

export function validateCredentialWritePathPrefixes(
  raw: unknown,
  workspacePrefixes: string[],
): string | null {
  const error = validateAgentWritePathPrefixes(raw, 'writePathPrefixes');
  if (error) {
    return error;
  }
  const parsed = parseAgentWritePathPrefixes(raw);
  if (!parsed) {
    return null;
  }
  const resolved = resolveAgentWritePathPrefixes({
    workspacePrefixes,
    tokenPrefixes: parsed,
  });
  if (resolved.length === 0) {
    return 'writePathPrefixes must stay within workspace write path prefixes.';
  }
  return null;
}

export function validateCorpusAgentWritePathPrefixes(
  corpusPrefixes: unknown,
  workspacePrefixes: string[],
): string | null {
  const error = validateAgentWritePathPrefixes(corpusPrefixes, 'settings.agentWritePathPrefixes');
  if (error) {
    return error;
  }
  const parsed = parseAgentWritePathPrefixes(corpusPrefixes);
  if (!parsed) {
    return null;
  }
  const resolved = resolveAgentWritePathPrefixes({
    workspacePrefixes: workspacePrefixes,
    corpusPrefixes: parsed,
  });
  if (resolved.length === 0) {
    return 'settings.agentWritePathPrefixes must stay within workspace write path prefixes.';
  }
  return null;
}

function intersectPrefixLayers(parent: string[], child: string[]): string[] {
  const out: string[] = [];
  for (const childPrefix of child) {
    for (const parentPrefix of parent) {
      if (prefixCovers(parentPrefix, childPrefix)) {
        out.push(childPrefix);
        break;
      }
      if (prefixCovers(childPrefix, parentPrefix)) {
        out.push(parentPrefix);
        break;
      }
    }
  }
  return [...new Set(out)];
}

export function resolveAgentWritePathPrefixes(layers: AgentWritePathLayers): string[] {
  const workspace =
    layers.workspacePrefixes && layers.workspacePrefixes.length > 0
      ? layers.workspacePrefixes.map(normalizeAgentWritePrefix)
      : defaultAgentWritePathPrefixes();

  let effective = workspace;
  if (layers.corpusPrefixes && layers.corpusPrefixes.length > 0) {
    effective = intersectPrefixLayers(
      effective,
      layers.corpusPrefixes.map(normalizeAgentWritePrefix),
    );
  }
  if (layers.tokenPrefixes && layers.tokenPrefixes.length > 0) {
    effective = intersectPrefixLayers(
      effective,
      layers.tokenPrefixes.map(normalizeAgentWritePrefix),
    );
  }
  return effective;
}

export function assertAgentWritePath(input: string, allowedPrefixes: string[]): string {
  const normalized = normalizeAgentWritePath(input);
  if (allowedPrefixes.length === 0) {
    throw new AgentWritePathError('No agent write path prefixes are configured.');
  }
  const allowed = allowedPrefixes.some((prefix) => prefixCovers(prefix, normalized));
  if (!allowed) {
    throw new AgentWritePathError(
      `Agent write path must be under one of: ${allowedPrefixes.join(', ')}`,
    );
  }
  return normalized;
}

export function assertAgentNotesPath(input: string): string {
  return assertAgentWritePath(input, defaultAgentWritePathPrefixes());
}

export function splitAgentWritePath(
  fullPath: string,
  allowedPrefixes: string[] = defaultAgentWritePathPrefixes(),
): { folderPath: string; name: string } {
  const normalized = assertAgentWritePath(fullPath, allowedPrefixes);
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex === -1) {
    throw new AgentWritePathError('Agent write path must include a file name.');
  }
  return {
    folderPath: normalized.slice(0, slashIndex),
    name: normalized.slice(slashIndex + 1),
  };
}

export function joinAgentWritePath(
  folderPath: string,
  name: string,
  allowedPrefixes: string[] = defaultAgentWritePathPrefixes(),
): string {
  const normalizedName = normalizeAgentWritePath(name);
  if (normalizedName.includes('/')) {
    throw new AgentWritePathError('File name must not contain path separators.');
  }
  const normalizedFolder = folderPath ? normalizeAgentWritePath(folderPath) : agentNotesRoot;
  return assertAgentWritePath(`${normalizedFolder}/${normalizedName}`, allowedPrefixes);
}
