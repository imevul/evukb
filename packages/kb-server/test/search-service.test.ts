import { asCorpusId, asNodeId, asWorkspaceId, type KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { SearchService } from '../src/services/search-service.js';

function indexedNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: asNodeId('node-1'),
    workspaceId: asWorkspaceId('workspace-1'),
    corpusId: asCorpusId('corpus-1'),
    parentId: null,
    path: 'docs',
    name: 'ops-guide.md',
    nodeType: 'file',
    storageRelPath: 'docs/ops-guide.md',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 100,
    indexStatus: 'indexed',
    metadata: {
      frontmatter: { type: 'Playbook', title: 'Ops Guide', tags: ['ops'] },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseServiceDeps(
  overrides: {
    chunks?: Record<string, unknown>;
    corpora?: Record<string, unknown>;
    nodes?: Record<string, unknown>;
    workspaces?: Record<string, unknown>;
    embeddingProvider?: unknown;
    vectorStore?: Record<string, unknown>;
  } = {},
) {
  return {
    chunks: {
      searchKeyword: vi.fn().mockResolvedValue([]),
      listByIds: vi.fn().mockResolvedValue([]),
      ...overrides.chunks,
    },
    corpora: {
      getById: vi.fn().mockResolvedValue({
        id: 'corpus-1',
        settings: {},
        rankingStrategyId: 'hybrid_default_v1',
      }),
      ...overrides.corpora,
    },
    nodes: {
      listByIds: vi.fn().mockResolvedValue([]),
      ...overrides.nodes,
    },
    workspaces: {
      getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      ...overrides.workspaces,
    },
    embeddingProvider: overrides.embeddingProvider ?? null,
    vectorStore: {
      search: vi.fn().mockResolvedValue([]),
      ...overrides.vectorStore,
    },
  };
}

describe('SearchService filters', () => {
  it('drops hits that do not match tag filters', async () => {
    const chunks = {
      searchKeyword: vi.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          nodeId: 'node-1',
          filePath: 'docs/ops-guide.md',
          headingPath: ['Intro'],
          body: 'Operations guide content.',
          indexedAt: '2026-01-01T00:00:00.000Z',
          keywordScore: 0.8,
        },
        {
          id: 'chunk-2',
          nodeId: 'node-2',
          filePath: 'docs/other.md',
          headingPath: ['Intro'],
          body: 'Other content.',
          indexedAt: '2026-01-01T00:00:00.000Z',
          keywordScore: 0.7,
        },
      ]),
      listByIds: vi.fn().mockImplementation((_ws, _corpus, ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({
            id,
            nodeId: id === 'chunk-1' ? 'node-1' : 'node-2',
            filePath: id === 'chunk-1' ? 'docs/ops-guide.md' : 'docs/other.md',
            headingPath: ['Intro'],
            bodyPreview: 'preview',
            body: 'body',
            indexedAt: '2026-01-01T00:00:00.000Z',
          })),
        ),
      ),
    };

    const nodes = {
      listByIds: vi.fn().mockResolvedValue([
        indexedNode(),
        indexedNode({
          id: asNodeId('node-2'),
          name: 'other.md',
          metadata: { frontmatter: { type: 'Document', tags: ['general'] } },
        }),
      ]),
    };

    const service = new SearchService({
      ...baseServiceDeps({ chunks, nodes }),
    } as never);

    const results = await service.search('workspace-1', 'corpus-1', {
      query: 'operations',
      filters: { tags: ['ops'] },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.filePath).toBe('docs/ops-guide.md');
    expect(chunks.searchKeyword).toHaveBeenCalledWith(
      'workspace-1',
      'corpus-1',
      'operations',
      expect.objectContaining({ filters: { tags: ['ops'] } }),
    );
  });

  it('rejects reranker_llm without chat provider', async () => {
    const service = new SearchService(baseServiceDeps() as never);

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'reranker_llm',
      }),
    ).rejects.toThrow('reranker_llm requires a configured chat provider');
  });
});

describe('SearchService ranking strategies', () => {
  it('accepts semantic_only when embedding provider is configured', async () => {
    const chunks = {
      searchKeyword: vi.fn().mockResolvedValue([]),
      listByIds: vi.fn().mockResolvedValue([]),
    };
    const vectorStore = { search: vi.fn().mockResolvedValue([]) };
    const embeddingProvider = {
      embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
      health: vi.fn().mockResolvedValue({ status: 'ok', model: 'test' }),
    };

    const service = new SearchService(
      baseServiceDeps({ chunks, vectorStore, embeddingProvider }) as never,
    );

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'semantic_only',
      }),
    ).resolves.toEqual([]);

    expect(chunks.searchKeyword).not.toHaveBeenCalled();
    expect(vectorStore.search).toHaveBeenCalled();
  });

  it('rejects semantic_only without embedding provider', async () => {
    const service = new SearchService(baseServiceDeps() as never);

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'semantic_only',
      }),
    ).rejects.toThrow('semantic_only requires a configured embedding provider');
  });

  it('keyword_only skips vector search', async () => {
    const chunks = {
      searchKeyword: vi.fn().mockResolvedValue([]),
      listByIds: vi.fn().mockResolvedValue([]),
    };
    const vectorStore = { search: vi.fn().mockResolvedValue([]) };
    const embeddingProvider = {
      embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
      health: vi.fn().mockResolvedValue({ status: 'ok', model: 'test' }),
    };

    const service = new SearchService(
      baseServiceDeps({ chunks, vectorStore, embeddingProvider }) as never,
    );

    await service.search('workspace-1', 'corpus-1', {
      query: 'operations',
      rankingStrategyId: 'keyword_only',
    });

    expect(chunks.searchKeyword).toHaveBeenCalled();
    expect(vectorStore.search).not.toHaveBeenCalled();
    expect(embeddingProvider.embed).not.toHaveBeenCalled();
  });

  it('uses workspace rankingStrategyId when corpus and request omit it', async () => {
    const chunks = {
      searchKeyword: vi.fn().mockResolvedValue([]),
      listByIds: vi.fn().mockResolvedValue([]),
    };

    const service = new SearchService(
      baseServiceDeps({
        chunks,
        workspaces: {
          getById: vi.fn().mockResolvedValue({
            id: 'workspace-1',
            settings: { rankingStrategyId: 'keyword_only' },
          }),
        },
      }) as never,
    );

    await service.search('workspace-1', 'corpus-1', { query: 'operations' });

    expect(chunks.searchKeyword).toHaveBeenCalled();
  });

  it('accepts recency_boosted and citation_boosted strategies', async () => {
    const service = new SearchService(baseServiceDeps() as never);

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'recency_boosted',
      }),
    ).resolves.toEqual([]);

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'citation_boosted',
      }),
    ).resolves.toEqual([]);
  });

  it('invokes llm reranker for reranker_llm when chat provider is configured', async () => {
    const chatProvider = {
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({ content: '[]' }),
      completeStream: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok', model: 'test-model' }),
    };
    const service = new SearchService({
      ...baseServiceDeps(),
      chatProvider,
    } as never);

    await expect(
      service.search('workspace-1', 'corpus-1', {
        query: 'operations',
        rankingStrategyId: 'reranker_llm',
      }),
    ).resolves.toEqual([]);
  });
});
