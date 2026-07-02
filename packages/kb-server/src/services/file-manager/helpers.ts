import { type KnowledgeNode, normalizeRelativePath } from '@evu/kb-core';

import { ApiError } from '../../errors.js';
import type { NodeTreeEntry } from './types.js';

export function normalizeFolderPath(input: string): string {
  if (!input || input === '/') {
    return '';
  }
  try {
    return normalizeRelativePath(input.replace(/^\/+/, '').replace(/\/+$/, ''));
  } catch {
    throw ApiError.validation(`Unsafe folder path: ${input}`);
  }
}

export function normalizeNodeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw ApiError.validation('Name is required.');
  }
  try {
    normalizeRelativePath(trimmed);
  } catch {
    throw ApiError.validation(`Unsafe node name: ${name}`);
  }
  return trimmed;
}

export function buildNodePath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

export function collectDescendants(
  root: KnowledgeNode,
  nodes: KnowledgeNode[],
  target: Set<string>,
): void {
  target.add(root.id);
  const rootFullPath = buildNodePath(root.path, root.name);
  for (const node of nodes) {
    if (node.id === root.id) {
      continue;
    }
    const nodeFullPath = buildNodePath(node.path, node.name);
    if (
      node.path === rootFullPath ||
      node.path.startsWith(`${rootFullPath}/`) ||
      nodeFullPath.startsWith(`${rootFullPath}/`)
    ) {
      target.add(node.id);
    }
  }
}

export function buildNodeTree(nodes: KnowledgeNode[]): NodeTreeEntry[] {
  const entries = new Map<string, NodeTreeEntry>(
    nodes.map((node) => [node.id, { ...node, children: [] }]),
  );
  const roots: NodeTreeEntry[] = [];

  for (const node of entries.values()) {
    if (node.parentId && entries.has(node.parentId)) {
      entries.get(node.parentId)?.children.push(node);
      continue;
    }
    roots.push(node);
  }

  const sortEntries = (items: NodeTreeEntry[]): void => {
    items.sort((left, right) => {
      if (left.nodeType !== right.nodeType) {
        return left.nodeType === 'folder' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    for (const item of items) {
      sortEntries(item.children);
    }
  };
  sortEntries(roots);
  return roots;
}

export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
