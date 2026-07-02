import {
  asChunkId,
  asCorpusId,
  asNodeId,
  asWorkspaceId,
  type ChatCompletionInput,
  type ChatCompletionResult,
  type ChatProvider,
  type ChatProviderHealth,
  type SearchResult,
} from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { AskService } from '../src/services/ask-service.js';
import type { SearchService } from '../src/services/search-service.js';

function sampleSearchResult(): SearchResult {
  return {
    chunkId: asChunkId('chunk-1'),
    nodeId: asNodeId('node-1'),
    corpusId: asCorpusId('corpus-1'),
    workspaceId: asWorkspaceId('workspace-1'),
    filePath: 'notes/ask-target.md',
    headingPath: ['Answer'],
    bodyPreview: 'EvuKB ask alpha fixture.',
    score: 0.5,
    matchKind: 'keyword',
    citation: {
      citationId: asChunkId('chunk-1'),
      corpusId: asCorpusId('corpus-1'),
      nodeId: asNodeId('node-1'),
      chunkId: asChunkId('chunk-1'),
      filePath: 'notes/ask-target.md',
      headingPath: ['Answer'],
      sourceType: 'chunk',
    },
    ranking: {
      strategyId: 'hybrid_default_v1',
      strategyVersion: '1',
      componentScores: { keyword: 0.5 },
    },
  };
}

function createMockChatProvider(content: string, withUsage = false): ChatProvider {
  const usage = withUsage ? { inputTokens: 10, outputTokens: 5, latencyMs: 42 } : undefined;
  return {
    model: 'mock-model',
    async health(): Promise<ChatProviderHealth> {
      return { status: 'ok', model: 'mock-model' };
    },
    async complete(_input: ChatCompletionInput): Promise<ChatCompletionResult> {
      return { content, ...(usage ? { usage } : {}) };
    },
    async *completeStream(_input: ChatCompletionInput) {
      yield { type: 'token', delta: content };
      yield { type: 'done', ...(usage ? { usage } : {}) };
    },
  };
}

describe('AskService', () => {
  it('returns citations from retrieved chunks, not the LLM', async () => {
    const searchHit = sampleSearchResult();
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([searchHit]),
    } as unknown as SearchService;

    const service = new AskService({
      chatProvider: createMockChatProvider('Answer with [1].'),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: {
        getByIdInWorkspace: vi.fn(),
      } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
    });

    const response = await service.ask('workspace-1', 'corpus-1', {
      question: 'What is the alpha fixture?',
    });

    expect(response.answer).toBe('Answer with [1].');
    expect(response.citations).toEqual([searchHit.citation]);
    expect(response.usedChunks).toEqual([searchHit]);
    expect(response.model).toBe('mock-model');
    expect(response.retrievalTrace).toMatchObject({
      query: 'What is the alpha fixture?',
      strategyId: 'hybrid_default_v1',
      candidateCount: 1,
      selectedCount: 1,
    });
  });

  it('adds warnings when retrieval is empty', async () => {
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([]),
    } as unknown as SearchService;

    const service = new AskService({
      chatProvider: createMockChatProvider('I do not have enough context.'),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: {
        getByIdInWorkspace: vi.fn(),
      } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
    });

    const response = await service.ask('workspace-1', 'corpus-1', {
      question: 'Unknown topic?',
    });

    expect(response.warnings).toContain(
      'No indexed chunks matched the question; answer may be uncertain.',
    );
    expect(response.citations).toEqual([]);
  });

  it('throws service unavailable when chat provider is missing', async () => {
    const service = new AskService({
      chatProvider: null,
      corpora: {
        getById: vi.fn(),
      } as never,
      nodes: {
        getByIdInWorkspace: vi.fn(),
      } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search: {
        searchAcrossCorpora: vi.fn(),
      } as unknown as SearchService,
    });

    await expect(
      service.ask('workspace-1', 'corpus-1', { question: 'Hello?' }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'service_unavailable',
    });
  });

  it('filters chunks to a focused node when nodeId is provided', async () => {
    const matching = sampleSearchResult();
    const other = {
      ...sampleSearchResult(),
      nodeId: asNodeId('node-2'),
      chunkId: asChunkId('chunk-2'),
      citation: {
        ...sampleSearchResult().citation,
        nodeId: asNodeId('node-2'),
        chunkId: asChunkId('chunk-2'),
      },
    };
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([matching, other]),
    } as unknown as SearchService;

    const service = new AskService({
      chatProvider: createMockChatProvider('Focused answer.'),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: {
        getByIdInWorkspace: vi.fn().mockResolvedValue({ id: 'node-1', corpusId: 'corpus-1' }),
      } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
    });

    const response = await service.ask('workspace-1', 'corpus-1', {
      question: 'Focused?',
      nodeId: 'node-1',
    });

    expect(response.usedChunks).toEqual([matching]);
    expect(response.citations).toEqual([matching.citation]);
  });

  it('passes rankingStrategyId to searchAcrossCorpora', async () => {
    const searchHit = sampleSearchResult();
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([searchHit]),
    } as unknown as SearchService;

    const service = new AskService({
      chatProvider: createMockChatProvider('Answer.'),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: { getByIdInWorkspace: vi.fn() } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
    });

    await service.askCorpora('workspace-1', {
      question: 'What is the alpha fixture?',
      corpusIds: ['corpus-1'],
      rankingStrategyId: 'recency_boosted',
    });

    expect(search.searchAcrossCorpora).toHaveBeenCalledWith(
      'workspace-1',
      ['corpus-1'],
      expect.objectContaining({ rankingStrategyId: 'recency_boosted' }),
    );
  });

  it('passes reranker_llm and reports strategy in retrieval trace', async () => {
    const first = {
      ...sampleSearchResult(),
      chunkId: asChunkId('chunk-1'),
      filePath: 'first-rerank.md',
      ranking: {
        strategyId: 'reranker_llm',
        strategyVersion: '1',
        componentScores: { llmRerank: 2 },
      },
    };
    const second = {
      ...sampleSearchResult(),
      chunkId: asChunkId('chunk-2'),
      filePath: 'second-rerank.md',
      citation: {
        ...sampleSearchResult().citation,
        chunkId: asChunkId('chunk-2'),
      },
      ranking: {
        strategyId: 'reranker_llm',
        strategyVersion: '1',
        componentScores: { llmRerank: 1 },
      },
    };
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([second, first]),
    } as unknown as SearchService;

    const service = new AskService({
      chatProvider: createMockChatProvider('Answer.'),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: { getByIdInWorkspace: vi.fn() } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
    });

    const response = await service.askCorpora('workspace-1', {
      question: 'rerank fixture',
      corpusIds: ['corpus-1'],
      rankingStrategyId: 'reranker_llm',
    });

    expect(search.searchAcrossCorpora).toHaveBeenCalledWith(
      'workspace-1',
      ['corpus-1'],
      expect.objectContaining({ rankingStrategyId: 'reranker_llm' }),
    );
    expect(response.retrievalTrace.strategyId).toBe('reranker_llm');
    expect(response.usedChunks[0]?.ranking.componentScores.llmRerank).toBe(1);
  });

  it('records ask usage and returns operationUsage when provider reports tokens', async () => {
    const searchHit = sampleSearchResult();
    const search = {
      searchAcrossCorpora: vi.fn().mockResolvedValue([searchHit]),
    } as unknown as SearchService;
    const usageRecords = {
      create: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AskService({
      chatProvider: createMockChatProvider('Answer with usage.', true),
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1' }),
      } as never,
      nodes: { getByIdInWorkspace: vi.fn() } as never,
      workspaces: {
        getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: {} }),
      } as never,
      search,
      usageRecords: usageRecords as never,
    });

    const response = await service.ask('workspace-1', 'corpus-1', {
      question: 'What is the alpha fixture?',
    });

    expect(usageRecords.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        corpusId: 'corpus-1',
        operationType: 'ask',
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 42,
      }),
    );
    expect(response.operationUsage).toMatchObject({
      operationType: 'ask',
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 42,
    });
  });
});
