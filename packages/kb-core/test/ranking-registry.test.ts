import { describe, expect, it } from 'vitest';
import { defaultRankingStrategyId } from '../src/runtime.js';
import {
  citationBoostedStrategyId,
  createDefaultRankingStrategyRegistry,
  keywordOnlyStrategyId,
  recencyBoostedStrategyId,
  rerankerLlmStrategyId,
  semanticOnlyStrategyId,
} from '../src/search/ranking-registry.js';

describe('ranking strategy registry', () => {
  const registry = createDefaultRankingStrategyRegistry();

  it('resolves all active strategies', () => {
    expect(registry.resolve(defaultRankingStrategyId).retrieval).toEqual({
      keyword: true,
      semantic: true,
    });
    expect(registry.resolve(semanticOnlyStrategyId).retrieval).toEqual({
      keyword: false,
      semantic: true,
    });
    expect(registry.resolve(keywordOnlyStrategyId).retrieval).toEqual({
      keyword: true,
      semantic: false,
    });
    expect(registry.resolve(recencyBoostedStrategyId).retrieval).toEqual({
      keyword: true,
      semantic: true,
    });
    expect(registry.resolve(citationBoostedStrategyId).retrieval).toEqual({
      keyword: true,
      semantic: true,
    });
    expect(registry.resolve(rerankerLlmStrategyId).postRank).toBe('llm');
  });

  it('lists six active strategies', () => {
    expect(registry.list()).toHaveLength(6);
    expect(registry.list().map((strategy) => strategy.id)).toEqual([
      defaultRankingStrategyId,
      semanticOnlyStrategyId,
      keywordOnlyStrategyId,
      recencyBoostedStrategyId,
      citationBoostedStrategyId,
      rerankerLlmStrategyId,
    ]);
  });

  it('rejects unknown strategies', () => {
    expect(() => registry.resolve('unknown_strategy')).toThrow('Unknown ranking strategy');
  });
});
