import { asNodeId, type NodeId } from '../ids.js';
import type { KnowledgeLink } from '../link.js';
import type { KnowledgeNode } from '../node.js';

export type LinkResolutionInput = {
  targetPath: string | null;
  externalUrl: string | null;
  toNodeId?: NodeId | null;
};

export type LinkResolutionResult = {
  toNodeId: NodeId | null;
  resolved: boolean;
};

export function buildFilePath(nodePath: string, nodeName: string): string {
  return nodePath ? `${nodePath}/${nodeName}` : nodeName;
}

export function isMarkdownNode(node: KnowledgeNode): boolean {
  if (node.nodeType !== 'file') {
    return false;
  }
  if (node.name.toLowerCase().endsWith('.md')) {
    return true;
  }
  return node.mimeType === 'text/markdown' || node.mimeType === 'text/x-markdown';
}

export function buildMarkdownPathToNodeIdMap(nodes: KnowledgeNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    if (!isMarkdownNode(node)) {
      continue;
    }
    map.set(buildFilePath(node.path, node.name), node.id);
  }
  return map;
}

export function targetPathCandidates(filePath: string): string[] {
  const candidates = [filePath];
  if (filePath.endsWith('.md')) {
    candidates.push(filePath.slice(0, -3));
  } else {
    candidates.push(`${filePath}.md`);
  }
  return candidates;
}

export function isInternalLink(link: Pick<KnowledgeLink, 'externalUrl'>): boolean {
  return link.externalUrl == null;
}

export function resolveInternalLinkTarget(
  link: LinkResolutionInput,
  pathToNodeId: Map<string, string>,
): LinkResolutionResult {
  if (link.externalUrl != null) {
    return { toNodeId: null, resolved: false };
  }

  if (link.toNodeId) {
    return { toNodeId: link.toNodeId, resolved: true };
  }

  if (!link.targetPath) {
    return { toNodeId: null, resolved: false };
  }

  const candidates = targetPathCandidates(link.targetPath);
  for (const candidate of candidates) {
    const nodeId = pathToNodeId.get(candidate);
    if (nodeId) {
      return { toNodeId: asNodeId(nodeId), resolved: true };
    }
  }

  return { toNodeId: null, resolved: false };
}

export function resolveStoredInternalLink(
  link: KnowledgeLink,
  pathToNodeId: Map<string, string>,
): LinkResolutionResult {
  return resolveInternalLinkTarget(
    {
      targetPath: link.targetPath,
      externalUrl: link.externalUrl,
      toNodeId: link.toNodeId,
    },
    pathToNodeId,
  );
}
