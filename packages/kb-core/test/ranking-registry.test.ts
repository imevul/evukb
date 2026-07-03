import { describe, expect, it } from 'vitest';
import { defaultRankingStrategyId } from '../src/runtime.js';
import {
  citationBoostedStrategyId,
  createPresetRankingStrategy,
  createRankingStrategyRegistry,
  hybridDefaultV1Strategy,
  keywordOnlyStrategyId,
  recencyBoostedStrategyId,
  rerankerLlmStrategyId,
  semanticOnlyStrategyId,
} from '../src/search/ranking-registry.js';

describe('ranking strategy registry', () => {
  const registry = createRankingStrategyRegistry();

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

  it('lists six built-in strategies', () => {
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

  it('registers and unregisters custom strategies', () => {
    const custom = createPresetRankingStrategy({
      id: 'boost_agent_notes_v1',
      version: '1',
      label: 'Agent notes boost',
      weights: { pathBoosts: { 'agent-notes/': 2 } },
    });
    registry.register(custom);
    expect(registry.resolve('boost_agent_notes_v1').id).toBe('boost_agent_notes_v1');
    registry.unregister('boost_agent_notes_v1');
    expect(() => registry.resolve('boost_agent_notes_v1')).toThrow();
  });

  it('cannot unregister built-in strategies', () => {
    expect(() => registry.unregister(defaultRankingStrategyId)).toThrow(/built-in/);
  });

  it('exports explicit built-in strategy constants', () => {
    expect(hybridDefaultV1Strategy.label).toBe('Hybrid default');
    expect(hybridDefaultV1Strategy.builtin).toBe(true);
  });
});
