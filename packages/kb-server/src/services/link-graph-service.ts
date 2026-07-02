import {
  asNodeId,
  buildFilePath,
  buildMarkdownPathToNodeIdMap,
  type GraphNeighborhood,
  isInternalLink,
  isMarkdownNode,
  type KnowledgeLink,
  type KnowledgeLinkGraph,
  type KnowledgeLinkGraphEdge,
  type KnowledgeLinkGraphNode,
  type KnowledgeNode,
  type LinkGraphQuery,
  nodeHasValidationIssues,
  resolveStoredInternalLink,
} from '@evu/kb-core';
import type { CorpusRepository, LinkRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';

const DEFAULT_GRAPH_LIMIT = 250;

export type LinkGraphServiceDeps = {
  corpora: CorpusRepository;
  links: LinkRepository;
  nodes: NodeRepository;
};

function normalizeFolderPrefix(prefix: string | undefined): string {
  if (!prefix?.trim()) {
    return '';
  }
  const trimmed = prefix.trim().replace(/^\//, '').replace(/\/$/, '');
  return trimmed.length > 0 ? `${trimmed}/` : '';
}

function nodeMatchesPrefix(filePath: string, folderPrefix: string): boolean {
  if (folderPrefix.length === 0) {
    return true;
  }
  return filePath.startsWith(folderPrefix) || filePath === folderPrefix.replace(/\/$/, '');
}

function labelFromMetadata(metadata: Record<string, unknown>, fileName: string): string {
  const frontmatter = metadata.frontmatter;
  if (frontmatter && typeof frontmatter === 'object' && !Array.isArray(frontmatter)) {
    const title = (frontmatter as Record<string, unknown>).title;
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }
  }
  return fileName.replace(/\.md$/i, '');
}

function toGraphNode(node: KnowledgeNode): KnowledgeLinkGraphNode {
  return {
    nodeId: node.id,
    filePath: buildFilePath(node.path, node.name),
    label: labelFromMetadata(node.metadata, node.name),
    hasValidationIssues: nodeHasValidationIssues(node.metadata),
  };
}

function toGraphEdge(link: KnowledgeLink): KnowledgeLinkGraphEdge {
  return {
    id: link.id,
    fromNodeId: link.fromNodeId,
    toNodeId: link.toNodeId,
    targetPath: link.targetPath,
    raw: link.raw,
    resolved: link.resolved,
  };
}

export class LinkGraphService {
  readonly #corpora: CorpusRepository;
  readonly #links: LinkRepository;
  readonly #nodes: NodeRepository;

  constructor(deps: LinkGraphServiceDeps) {
    this.#corpora = deps.corpora;
    this.#links = deps.links;
    this.#nodes = deps.nodes;
  }

  async #requireCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    return corpus;
  }

  async #requireNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<KnowledgeNode> {
    const node = await this.#nodes.getById(workspaceId, corpusId, nodeId);
    if (!node) {
      throw ApiError.nodeNotFound(nodeId);
    }
    return node;
  }

  async getCorpusLinkGraph(
    workspaceId: string,
    corpusId: string,
    query: LinkGraphQuery = {},
  ): Promise<KnowledgeLinkGraph> {
    await this.#requireCorpus(workspaceId, corpusId);
    const limit = query.limit ?? DEFAULT_GRAPH_LIMIT;
    const folderPrefix = normalizeFolderPrefix(query.folderPrefix);

    const corpusNodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const markdownFiles = corpusNodes.filter(isMarkdownNode);
    const scopedFiles = markdownFiles.filter((node) =>
      nodeMatchesPrefix(buildFilePath(node.path, node.name), folderPrefix),
    );

    const truncatedNodes = scopedFiles.length > limit;
    const nodesSlice = scopedFiles.slice(0, limit);
    const nodeIdSet = new Set(nodesSlice.map((node) => node.id));

    if (nodeIdSet.size === 0) {
      return { nodes: [], edges: [], truncated: false };
    }

    const allLinks = await this.#links.listByCorpus(workspaceId, corpusId);
    const scopedEdges = allLinks.filter(
      (link) =>
        isInternalLink(link) &&
        nodeIdSet.has(link.fromNodeId) &&
        (link.toNodeId == null || nodeIdSet.has(link.toNodeId)),
    );

    const truncatedEdges = scopedEdges.length > limit * 2;
    const edgesSlice = scopedEdges.slice(0, limit * 2);

    return {
      nodes: nodesSlice.map(toGraphNode),
      edges: edgesSlice.map(toGraphEdge),
      truncated: truncatedNodes || truncatedEdges,
    };
  }

  async getNodeLinks(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<KnowledgeLink[]> {
    await this.#requireCorpus(workspaceId, corpusId);
    await this.#requireNode(workspaceId, corpusId, nodeId);
    return this.#links.listByNode(workspaceId, corpusId, nodeId);
  }

  async getGraphNeighborhood(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    options: { depth?: number; limit?: number } = {},
  ): Promise<GraphNeighborhood> {
    await this.#requireCorpus(workspaceId, corpusId);
    await this.#requireNode(workspaceId, corpusId, nodeId);

    const depth = options.depth ?? 1;
    const limit = options.limit ?? DEFAULT_GRAPH_LIMIT;
    const corpusNodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const markdownFiles = corpusNodes.filter(isMarkdownNode);
    const pathToNodeId = buildMarkdownPathToNodeIdMap(markdownFiles);
    const nodeById = new Map(markdownFiles.map((node) => [node.id, node]));

    const allLinks = await this.#links.listByCorpus(workspaceId, corpusId);
    const internalLinks = allLinks.filter(isInternalLink);

    const adjacency = new Map<string, KnowledgeLink[]>();
    for (const link of internalLinks) {
      const resolution = resolveStoredInternalLink(link, pathToNodeId);
      const targetNodeId = resolution.toNodeId;
      if (!targetNodeId || !nodeById.has(targetNodeId)) {
        continue;
      }
      const outgoing = adjacency.get(link.fromNodeId) ?? [];
      outgoing.push({ ...link, toNodeId: targetNodeId, resolved: resolution.resolved });
      adjacency.set(link.fromNodeId, outgoing);
    }

    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];
    for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
      const nextFrontier: string[] = [];
      for (const currentNodeId of frontier) {
        for (const link of adjacency.get(currentNodeId) ?? []) {
          const targetNodeId = link.toNodeId;
          if (!targetNodeId || visited.has(targetNodeId)) {
            continue;
          }
          if (visited.size >= limit) {
            return this.#buildNeighborhood(
              nodeId,
              visited,
              internalLinks,
              pathToNodeId,
              nodeById,
              true,
            );
          }
          visited.add(targetNodeId);
          nextFrontier.push(targetNodeId);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) {
        break;
      }
    }

    return this.#buildNeighborhood(nodeId, visited, internalLinks, pathToNodeId, nodeById, false);
  }

  #buildNeighborhood(
    centerNodeId: string,
    visitedNodeIds: Set<string>,
    links: KnowledgeLink[],
    pathToNodeId: Map<string, string>,
    nodeById: Map<string, KnowledgeNode>,
    truncated: boolean,
  ): GraphNeighborhood {
    const nodes = [...visitedNodeIds]
      .map((id) => nodeById.get(id))
      .filter((node): node is KnowledgeNode => node != null)
      .map(toGraphNode);

    const edges = links
      .filter((link) => {
        if (!visitedNodeIds.has(link.fromNodeId)) {
          return false;
        }
        const resolution = resolveStoredInternalLink(link, pathToNodeId);
        return resolution.toNodeId != null && visitedNodeIds.has(resolution.toNodeId);
      })
      .map((link) => {
        const resolution = resolveStoredInternalLink(link, pathToNodeId);
        return toGraphEdge({
          ...link,
          toNodeId: resolution.toNodeId,
          resolved: resolution.resolved,
        });
      });

    return {
      centerNodeId: asNodeId(centerNodeId),
      nodes,
      edges,
      truncated,
    };
  }
}
