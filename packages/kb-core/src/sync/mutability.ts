import type { NodeSourceType } from '../runtime.js';

import type { NodeMutability } from './types.js';

export type MutabilityNode = {
  sourceType: NodeSourceType;
  nodeType: 'folder' | 'file';
};

const READ_ONLY_REASONS: Record<Exclude<NodeSourceType, 'managed' | 'import'>, string> = {
  shared_mount: 'Imported from shared mount (read-only).',
  git: 'Imported from git repository (read-only).',
  reference: 'OKF reference mirror (read-only).',
};

export function resolveNodeMutability(node: MutabilityNode): NodeMutability {
  if (node.nodeType === 'folder' && node.sourceType === 'managed') {
    return { editable: true };
  }

  if (node.sourceType === 'managed' || node.sourceType === 'import') {
    return { editable: true };
  }

  const reason = READ_ONLY_REASONS[node.sourceType];
  return {
    editable: false,
    reason,
  };
}

export function assertNodeEditable(node: MutabilityNode): void {
  const mutability = resolveNodeMutability(node);
  if (!mutability.editable) {
    throw new Error(mutability.reason ?? 'Node is read-only.');
  }
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
