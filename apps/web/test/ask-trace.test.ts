import { firstRerankUsage, mapOperationUsage, mergeAskStreamDone } from '@evu/kb-ui';
import { describe, expect, it } from 'vitest';

describe('ask-trace helpers', () => {
  it('merges stream done operationUsage into the ask response', () => {
    const merged = mergeAskStreamDone(
      {
        answer: 'Done',
        citations: [],
        usedChunks: [],
        warnings: [],
        model: 'gpt-test',
        retrievalTrace: {
          query: 'alpha',
          strategyId: 'hybrid_default_v1',
          candidateCount: 2,
          selectedCount: 1,
        },
      },
      {
        provider: 'openai-compatible',
        model: 'gpt-test',
        operationType: 'ask',
        inputTokens: 10,
        outputTokens: 5,
        requestCount: 1,
        latencyMs: 42,
      },
    );

    expect(merged.operationUsage?.inputTokens).toBe(10);
    expect(mapOperationUsage(merged.operationUsage)?.latencyMs).toBe(42);
  });

  it('finds rerank usage on search hits', () => {
    const usage = firstRerankUsage([
      {
        chunkId: 'chunk-1',
        nodeId: 'node-1',
        corpusId: 'corpus-1',
        workspaceId: 'workspace-1',
        filePath: 'notes/a.md',
        headingPath: [],
        bodyPreview: 'preview',
        score: 0.5,
        matchKind: 'both',
        citation: {
          citationId: 'chunk-1',
          corpusId: 'corpus-1',
          nodeId: 'node-1',
          chunkId: 'chunk-1',
          filePath: 'notes/a.md',
          headingPath: [],
          sourceType: 'chunk',
        },
        ranking: {
          strategyId: 'reranker_llm',
          strategyVersion: '1',
          componentScores: { hybrid: 0.5 },
          operationUsage: {
            provider: 'openai-compatible',
            model: 'gpt-test',
            operationType: 'rerank',
            requestCount: 1,
            latencyMs: 50,
          },
        },
      },
    ]);

    expect(usage?.operationType).toBe('rerank');
  });
});
