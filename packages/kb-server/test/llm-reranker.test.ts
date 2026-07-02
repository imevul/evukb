import type { ChatProvider, RankedSearchHit } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { applyRerankOrder, parseRerankOrder, rerankWithLlm } from '../src/services/llm-reranker.js';

function hit(chunkId: string, score = 1): RankedSearchHit {
  return {
    chunkId,
    keywordScore: score,
    semanticScore: score,
    score,
    matchKind: 'both',
    componentScores: { hybrid: score },
  };
}

describe('llm reranker', () => {
  it('parses JSON chunk id order', () => {
    const validIds = new Set(['a', 'b']);
    expect(parseRerankOrder('["b","a"]', validIds)).toEqual(['b', 'a']);
  });

  it('reorders hits and records llmRerank component scores', () => {
    const reranked = applyRerankOrder([hit('a', 0.9), hit('b', 0.8)], ['b', 'a']);
    expect(reranked.map((entry) => entry.chunkId)).toEqual(['b', 'a']);
    expect(reranked[0]?.componentScores.llmRerank).toBe(1);
  });

  it('uses chat provider response to reorder hits', async () => {
    const chatProvider: ChatProvider = {
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({ content: '["chunk-2","chunk-1"]' }),
      completeStream: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok', model: 'test-model' }),
    };

    const reranked = await rerankWithLlm({
      query: 'operations runbook',
      hits: [hit('chunk-1'), hit('chunk-2')],
      previews: new Map([
        ['chunk-1', 'first preview'],
        ['chunk-2', 'second preview'],
      ]),
      filePaths: new Map([
        ['chunk-1', 'docs/first.md'],
        ['chunk-2', 'docs/second.md'],
      ]),
      chatProvider,
    });

    expect(reranked.hits.map((entry) => entry.chunkId)).toEqual(['chunk-2', 'chunk-1']);
    expect(chatProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('filePath=docs/first.md'),
          }),
        ]),
      }),
    );
  });

  it('falls back to hybrid order when parsing fails', async () => {
    const chatProvider: ChatProvider = {
      model: 'test-model',
      complete: vi.fn().mockResolvedValue({ content: 'not-json' }),
      completeStream: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok', model: 'test-model' }),
    };

    const hits = [hit('chunk-1'), hit('chunk-2')];
    const reranked = await rerankWithLlm({
      query: 'operations runbook',
      hits,
      previews: new Map([
        ['chunk-1', 'first preview'],
        ['chunk-2', 'second preview'],
      ]),
      chatProvider,
    });

    expect(reranked.hits.map((entry) => entry.chunkId)).toEqual(['chunk-1', 'chunk-2']);
  });
});
