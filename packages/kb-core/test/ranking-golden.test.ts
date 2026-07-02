import { describe, expect, it } from 'vitest';

import { rankingGoldenCases, rankingGoldenRegistry } from './fixtures/ranking-golden.js';

describe('ranking golden fixtures', () => {
  for (const goldenCase of rankingGoldenCases) {
    it(`ranks ${goldenCase.strategyId} with stable golden top hit`, () => {
      const strategy = rankingGoldenRegistry.resolve(goldenCase.strategyId);
      const ranked = strategy.rank(goldenCase.candidates);
      expect(ranked[0]?.chunkId).toBe(goldenCase.expectedTop);
    });
  }
});
