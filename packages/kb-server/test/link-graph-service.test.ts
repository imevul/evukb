import type { KnowledgeLink, KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { LinkGraphService } from '../src/services/link-graph-service.js';

function createNode(
  overrides: Partial<KnowledgeNode> & Pick<KnowledgeNode, 'id' | 'name'>,
): KnowledgeNode {
  return {
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: '',
    nodeType: 'file',
    storageRelPath: 'managed/x',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 10,
    indexStatus: 'indexed',
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createLink(
  overrides: Partial<KnowledgeLink> & Pick<KnowledgeLink, 'id' | 'fromNodeId'>,
): KnowledgeLink {
  return {
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    toNodeId: null,
    linkKind: 'wikilink',
    raw: '[[target]]',
    targetPath: 'target.md',
    externalUrl: null,
    resolved: false,
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('LinkGraphService', () => {
  it('scopes corpus link graph to folder prefix and excludes external edges', async () => {
    const nodeA = createNode({ id: 'node-a', name: 'a.md', path: 'guides' });
    const nodeB = createNode({ id: 'node-b', name: 'b.md', path: 'guides' });
    const nodeRoot = createNode({ id: 'node-root', name: 'root.md', path: '' });

    const service = new LinkGraphService({
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      },
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([nodeA, nodeB, nodeRoot]),
        getById: vi.fn(),
      },
      links: {
        listByCorpus: vi.fn().mockResolvedValue([
          createLink({
            id: 'edge-1',
            fromNodeId: 'node-a',
            toNodeId: 'node-b',
            targetPath: 'guides/b.md',
          }),
          createLink({
            id: 'edge-ext',
            fromNodeId: 'node-a',
            externalUrl: 'https://example.com',
            targetPath: null,
          }),
          createLink({ id: 'edge-root', fromNodeId: 'node-root', targetPath: 'guides/a.md' }),
        ]),
        listByNode: vi.fn(),
      },
    } as never);

    const graph = await service.getCorpusLinkGraph('ws-1', 'corpus-1', {
      folderPrefix: 'guides',
    });

    expect(graph.nodes.map((node) => node.nodeId)).toEqual(['node-a', 'node-b']);
    expect(graph.edges.map((edge) => edge.id)).toEqual(['edge-1']);
  });

  it('marks graph truncated when node cap is exceeded', async () => {
    const nodes = Array.from({ length: 3 }, (_, index) =>
      createNode({ id: `node-${index}`, name: `file-${index}.md` }),
    );

    const service = new LinkGraphService({
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      },
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue(nodes),
        getById: vi.fn(),
      },
      links: {
        listByCorpus: vi.fn().mockResolvedValue([]),
        listByNode: vi.fn(),
      },
    } as never);

    const graph = await service.getCorpusLinkGraph('ws-1', 'corpus-1', { limit: 2 });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.truncated).toBe(true);
  });

  it('returns neighborhood around resolved internal path targets', async () => {
    const nodeA = createNode({ id: 'node-a', name: 'a.md' });
    const nodeB = createNode({ id: 'node-b', name: 'b.md' });

    const service = new LinkGraphService({
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      },
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([nodeA, nodeB]),
        getById: vi
          .fn()
          .mockImplementation(async (_ws, _corpus, nodeId) =>
            nodeId === 'node-a' ? nodeA : nodeId === 'node-b' ? nodeB : null,
          ),
      },
      links: {
        listByCorpus: vi
          .fn()
          .mockResolvedValue([
            createLink({ id: 'edge-1', fromNodeId: 'node-a', targetPath: 'b.md' }),
          ]),
        listByNode: vi.fn(),
      },
    } as never);

    const neighborhood = await service.getGraphNeighborhood('ws-1', 'corpus-1', 'node-a', {
      depth: 1,
    });

    expect(neighborhood.centerNodeId).toBe('node-a');
    expect(neighborhood.nodes.map((node) => node.nodeId).sort()).toEqual(['node-a', 'node-b']);
    expect(neighborhood.edges).toHaveLength(1);
  });
});
