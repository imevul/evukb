import { defaultRankingStrategyId } from '../../src/runtime.js';
import type { RankingCandidate } from '../../src/search/ranking.js';
import {
  citationBoostedStrategyId,
  createDefaultRankingStrategyRegistry,
  keywordOnlyStrategyId,
  recencyBoostedStrategyId,
  rerankerLlmStrategyId,
  semanticOnlyStrategyId,
} from '../../src/search/ranking-registry.js';

export type RankingGoldenCase = {
  strategyId: string;
  candidates: RankingCandidate[];
  expectedTop: string;
};

export const rankingGoldenCases: RankingGoldenCase[] = [
  {
    strategyId: defaultRankingStrategyId,
    candidates: [
      {
        chunkId: 'both-legs',
        filePath: 'docs/both.md',
        keywordRank: 1,
        keywordScore: 0.9,
        semanticRank: 1,
        semanticScore: 0.9,
      },
      {
        chunkId: 'keyword-only',
        filePath: 'alpha.md',
        keywordRank: 2,
        keywordScore: 1,
      },
      {
        chunkId: 'semantic-only',
        filePath: 'beta.md',
        semanticRank: 2,
        semanticScore: 1,
      },
    ],
    expectedTop: 'both-legs',
  },
  {
    strategyId: keywordOnlyStrategyId,
    candidates: [
      {
        chunkId: 'both-legs',
        filePath: 'docs/both.md',
        keywordRank: 2,
        keywordScore: 0.9,
        semanticRank: 1,
        semanticScore: 0.9,
      },
      {
        chunkId: 'keyword-only',
        filePath: 'alpha.md',
        keywordRank: 1,
        keywordScore: 1,
      },
    ],
    expectedTop: 'keyword-only',
  },
  {
    strategyId: semanticOnlyStrategyId,
    candidates: [
      {
        chunkId: 'both-legs',
        filePath: 'docs/both.md',
        keywordRank: 1,
        keywordScore: 0.9,
        semanticRank: 2,
        semanticScore: 0.9,
      },
      {
        chunkId: 'semantic-only',
        filePath: 'beta.md',
        semanticRank: 1,
        semanticScore: 1,
      },
    ],
    expectedTop: 'semantic-only',
  },
  {
    strategyId: recencyBoostedStrategyId,
    candidates: [
      {
        chunkId: 'stale-plain',
        filePath: 'older.md',
        keywordRank: 1,
        keywordScore: 0.8,
        semanticRank: 1,
        semanticScore: 0.8,
        indexedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        chunkId: 'recent',
        filePath: 'recent.md',
        keywordRank: 1,
        keywordScore: 0.6,
        semanticRank: 1,
        semanticScore: 0.6,
        indexedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
    expectedTop: 'recent',
  },
  {
    strategyId: citationBoostedStrategyId,
    candidates: [
      {
        chunkId: 'stale-plain',
        filePath: 'older.md',
        keywordRank: 1,
        keywordScore: 0.8,
        semanticRank: 1,
        semanticScore: 0.8,
        indexedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        chunkId: 'stale-citation',
        filePath: 'old-citations.md',
        keywordRank: 1,
        keywordScore: 0.8,
        semanticRank: 1,
        semanticScore: 0.8,
        indexedAt: '2025-01-01T00:00:00.000Z',
        headingPath: ['Citations'],
        isOkfCitationSection: true,
      },
    ],
    expectedTop: 'stale-citation',
  },
];

export const rankingGoldenRegistry = createDefaultRankingStrategyRegistry();

export function isGoldenDeterministicStrategy(strategyId: string): boolean {
  return strategyId !== rerankerLlmStrategyId;
}
