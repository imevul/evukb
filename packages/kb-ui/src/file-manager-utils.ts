import type { FileTreeBreadcrumb, FileTreeListEntry, FileTreeNode } from './file-manager-types.js';

function formatScaledByteSize(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted} ${unit}`;
}

export function formatFileTreeBytes(bytes: number | undefined): string {
  if (bytes === undefined) {
    return '—';
  }
  if (bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KiB', 'MiB', 'GiB', 'TiB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return formatScaledByteSize(value, units[unitIndex] ?? 'KiB');
}

export function buildFileTreeBreadcrumbs(
  nodes: Array<{ id: string; parentId: string | null; name: string }>,
  currentParentId: string | null,
): FileTreeBreadcrumb[] {
  const crumbs: FileTreeBreadcrumb[] = [{ id: null, label: 'Root' }];
  if (!currentParentId) {
    return crumbs;
  }

  const chain: Array<{ id: string; parentId: string | null; name: string }> = [];
  let cursor: string | null = currentParentId;
  while (cursor) {
    const node = nodes.find((entry) => entry.id === cursor);
    if (!node) {
      break;
    }
    chain.unshift(node);
    cursor = node.parentId;
  }

  for (const folder of chain) {
    crumbs.push({ id: folder.id, label: folder.name });
  }
  return crumbs;
}

export function buildFileTreeListEntries(args: {
  folderChildren: FileTreeNode[];
  showParentRow: boolean;
}): FileTreeListEntry[] {
  const entries: FileTreeListEntry[] = [];
  if (args.showParentRow) {
    entries.push({ kind: 'parent' });
  }
  args.folderChildren.forEach((node, index) => {
    entries.push({ kind: 'node', node, selectableIndex: index });
  });
  return entries;
}

export function isDescendantOf(
  nodes: Array<{ id: string; parentId: string | null }>,
  nodeId: string,
  ancestorId: string,
): boolean {
  let cursor: string | null = nodeId;
  while (cursor) {
    if (cursor === ancestorId) {
      return true;
    }
    const row = nodes.find((entry) => entry.id === cursor);
    cursor = row?.parentId ?? null;
  }
  return false;
}

export function isInvalidMoveTarget(
  nodes: Array<{ id: string; parentId: string | null }>,
  nodeId: string,
  targetParentId: string | null,
): boolean {
  if (targetParentId === nodeId) {
    return true;
  }
  if (targetParentId && isDescendantOf(nodes, targetParentId, nodeId)) {
    return true;
  }
  return false;
}

export function nodeFolderPath(node: Pick<FileTreeNode, 'path' | 'name'>): string {
  return node.path ? `${node.path}/${node.name}` : node.name;
}
