import type { NodeSourceType } from '../runtime.js';

import { isGitWritebackEnabled } from './authoritative.js';
import { parseCorpusSyncSettings } from './settings.js';
import type { NodeMutability } from './types.js';

export type MutabilityNode = {
  sourceType: NodeSourceType;
  nodeType: 'folder' | 'file';
};

export type MutabilityOptions = {
  /** When true, git-sourced files are editable (corpus + env already resolved). */
  gitWritebackEnabled?: boolean;
};

const READ_ONLY_REASONS: Record<Exclude<NodeSourceType, 'managed' | 'import'>, string> = {
  shared_mount: 'Imported from shared mount (read-only).',
  git: 'Imported from git repository (read-only).',
  reference: 'OKF reference mirror (read-only).',
};

export function resolveNodeMutability(
  node: MutabilityNode,
  options: MutabilityOptions = {},
): NodeMutability {
  if (node.nodeType === 'folder' && node.sourceType === 'managed') {
    return { editable: true };
  }

  if (node.sourceType === 'managed' || node.sourceType === 'import') {
    return { editable: true };
  }

  if (node.sourceType === 'git' && options.gitWritebackEnabled === true) {
    return { editable: true };
  }

  const reason = READ_ONLY_REASONS[node.sourceType];
  return {
    editable: false,
    reason,
  };
}

export function assertNodeEditable(node: MutabilityNode, options: MutabilityOptions = {}): void {
  const mutability = resolveNodeMutability(node, options);
  if (!mutability.editable) {
    throw new Error(mutability.reason ?? 'Node is read-only.');
  }
}

/**
 * True when env gate is on, corpus is git-backed, and writeback is opted in.
 */
export function isCorpusGitWritebackActive(
  settings: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isGitWritebackEnabled(env)) {
    return false;
  }
  const sync = parseCorpusSyncSettings(settings);
  return sync.importKind === 'git' && sync.gitWritebackEnabled === true;
}

export function resolveSyncedSourceType(relativePath: string): NodeSourceType {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('references/') || normalized === 'references') {
    return 'reference';
  }
  return 'shared_mount';
}

export function resolveGitSourceType(relativePath: string): NodeSourceType {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('references/') || normalized === 'references') {
    return 'reference';
  }
  return 'git';
}
