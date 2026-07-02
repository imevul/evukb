import { describe, expect, it } from 'vitest';

import {
  resolveEffectiveRankingSettings,
  resolvePathBoost,
} from '../src/search/effective-ranking.js';
import { rankHybridDefaultV1 } from '../src/search/ranking.js';
import {
  citationBoostedStrategyId,
  createDefaultRankingStrategyRegistry,
  recencyBoostedStrategyId,
} from '../src/search/ranking-registry.js';

describe('effective ranking settings', () => {
  it('merges workspace, corpus, and request layers with defaults', () => {
    const effective = resolveEffectiveRankingSettings({
      workspaceSettings: { rankingSettings: { keywordWeight: 0.5 } },
      corpusSettings: { rankingSettings: { semanticWeight: 2, pathBoosts: { docs: 1.5 } } },
      requestOverride: { keywordWeight: 0.8 },
    });
    expect(effective.keywordWeight).toBe(0.8);
    expect(effective.semanticWeight).toBe(2);
    expect(effective.pathBoosts).toEqual({ docs: 1.5 });
  });

  it('picks longest matching path boost prefix', () => {
    expect(resolvePathBoost('docs/guide.md', { docs: 1.2, 'docs/guide': 2 })).toBe(2);
    expect(resolvePathBoost('other/file.md', { docs: 1.2 })).toBe(1);
  });
});

describe('rankHybridDefaultV1 weights', () => {
  const candidates = [
    { chunkId: 'kw-only', filePath: 'alpha.md', keywordRank: 1, keywordScore: 1 },
    { chunkId: 'sem-only', filePath: 'beta.md', semanticRank: 1, semanticScore: 1 },
  ];

  it('uses default weights of 1 when unset', () => {
    const ranked = rankHybridDefaultV1(candidates);
    expect(ranked[0]?.chunkId).toBeDefined();
    expect(ranked[0]?.componentScores.keywordWeight).toBe(1);
  });

  it('applies keyword and semantic weight multipliers', () => {
    const keywordHeavy = rankHybridDefaultV1(candidates, {
      keywordWeight: 10,
      semanticWeight: 0.1,
    });
    expect(keywordHeavy[0]?.chunkId).toBe('kw-only');

    const semanticHeavy = rankHybridDefaultV1(candidates, {
      keywordWeight: 0.1,
      semanticWeight: 10,
    });
    expect(semanticHeavy[0]?.chunkId).toBe('sem-only');
  });

  it('applies path boosts to final score', () => {
    const boosted = rankHybridDefaultV1(
      [{ chunkId: 'a', filePath: 'docs/a.md', keywordRank: 2, keywordScore: 1 }],
      { pathBoosts: { docs: 3 } },
    );
    const plain = rankHybridDefaultV1([
      { chunkId: 'a', filePath: 'docs/a.md', keywordRank: 2, keywordScore: 1 },
    ]);
    expect(boosted[0]?.score).toBeGreaterThan(plain[0]?.score ?? 0);
    expect(boosted[0]?.componentScores.pathBoost).toBe(3);
  });
});

describe('named ranking strategies', () => {
  const registry = createDefaultRankingStrategyRegistry();

  it('recency_boosted favors recent chunks when recencyBoost is unset', () => {
    const recent = '2026-06-29T00:00:00.000Z';
    const older = '2026-01-01T00:00:00.000Z';
    const candidates = [
      {
        chunkId: 'older',
        filePath: 'a.md',
        keywordRank: 1,
        keywordScore: 1,
        indexedAt: older,
      },
      {
        chunkId: 'recent',
        filePath: 'b.md',
        keywordRank: 1,
        keywordScore: 1,
        indexedAt: recent,
      },
    ];
    const ranked = registry.resolve(recencyBoostedStrategyId).rank(candidates);
    expect(ranked[0]?.chunkId).toBe('recent');
  });

  it('citation_boosted favors OKF citation sections when okfCitationBoost is unset', () => {
    const candidates = [
      {
        chunkId: 'plain',
        filePath: 'a.md',
        keywordRank: 1,
        keywordScore: 1,
        headingPath: ['Intro'],
        isOkfCitationSection: false,
      },
      {
        chunkId: 'citations',
        filePath: 'b.md',
        keywordRank: 1,
        keywordScore: 1,
        headingPath: ['Citations'],
        isOkfCitationSection: true,
      },
    ];
    const ranked = registry.resolve(citationBoostedStrategyId).rank(candidates);
    expect(ranked[0]?.chunkId).toBe('citations');
  });

  it('recency_boosted respects explicit recencyBoost override', () => {
    const candidates = [
      {
        chunkId: 'older',
        filePath: 'a.md',
        keywordRank: 1,
        keywordScore: 1,
        indexedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        chunkId: 'recent',
        filePath: 'b.md',
        keywordRank: 1,
        keywordScore: 1,
        indexedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const ranked = registry.resolve(recencyBoostedStrategyId).rank(candidates, { recencyBoost: 0 });
    expect(ranked[0]?.chunkId).toBe('older');
  });
});
