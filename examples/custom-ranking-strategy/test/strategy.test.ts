import { describe, expect, it } from 'vitest';

import { exampleRankingGoldenCases } from './fixtures/golden.js';

describe('example ranking strategies', () => {
  for (const goldenCase of exampleRankingGoldenCases) {
    it(`ranks ${goldenCase.strategy.id} with stable golden top hit`, () => {
      const ranked = goldenCase.strategy.rank(goldenCase.candidates);
      expect(ranked[0]?.chunkId).toBe(goldenCase.expectedTop);
    });
  }
});
