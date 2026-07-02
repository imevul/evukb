import { describe, expect, it } from 'vitest';

import {
  isOkfCitationChunkContent,
  isOkfCitationSectionHeading,
  resolveExactTitleMultiplier,
  resolveNodeTitleFromMetadata,
  resolveOkfCitationMultiplier,
  resolveRecencyMultiplier,
} from '../src/search/boosts.js';
import { rankHybridDefaultV1 } from '../src/search/ranking.js';

describe('ranking boost helpers', () => {
  it('returns 1 when recency boost is unset or indexedAt is missing', () => {
    expect(resolveRecencyMultiplier(undefined, 0.5)).toBe(1);
    expect(resolveRecencyMultiplier('2026-01-01T00:00:00.000Z', 0)).toBe(1);
  });

  it('favors recent chunks with recency boost', () => {
    const now = Date.parse('2026-06-30T00:00:00.000Z');
    const recent = resolveRecencyMultiplier('2026-06-29T00:00:00.000Z', 1, now);
    const older = resolveRecencyMultiplier('2026-01-01T00:00:00.000Z', 1, now);
    expect(recent).toBeGreaterThan(older);
    expect(recent).toBeGreaterThan(1);
  });

  it('detects OKF citation section headings', () => {
    expect(isOkfCitationSectionHeading(['Intro', 'Citations'])).toBe(true);
    expect(isOkfCitationSectionHeading(['Intro'])).toBe(false);
  });

  it('detects OKF citation chunk content from heading or body URLs', () => {
    expect(isOkfCitationChunkContent(['Intro', 'Citations'])).toBe(true);
    expect(isOkfCitationChunkContent(['Intro'], '- [Ref](https://example.com/doc)')).toBe(true);
    expect(isOkfCitationChunkContent(['Intro'], 'Plain text without links.')).toBe(false);
    expect(isOkfCitationChunkContent(['Intro'])).toBe(false);
  });

  it('applies OKF citation multiplier only in citation sections', () => {
    expect(resolveOkfCitationMultiplier(false, 0.5)).toBe(1);
    expect(resolveOkfCitationMultiplier(true, 0.5)).toBe(1.5);
  });

  it('applies exact title multiplier only on full title match', () => {
    expect(resolveExactTitleMultiplier('Alpha Guide', 'Alpha Guide', 0.25)).toBe(1.25);
    expect(resolveExactTitleMultiplier('Alpha', 'Alpha Guide', 0.25)).toBe(1);
  });

  it('reads node title from frontmatter metadata', () => {
    expect(
      resolveNodeTitleFromMetadata({
        frontmatter: { title: 'Runbook Alpha' },
      }),
    ).toBe('Runbook Alpha');
  });
});

describe('rankHybridDefaultV1 advanced boosts', () => {
  it('ranks newer chunks higher with recency boost', () => {
    const ranked = rankHybridDefaultV1(
      [
        {
          chunkId: 'old',
          keywordRank: 1,
          indexedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          chunkId: 'new',
          keywordRank: 2,
          indexedAt: '2026-06-29T00:00:00.000Z',
        },
      ],
      { recencyBoost: 2 },
    );
    expect(ranked[0]?.chunkId).toBe('new');
    expect(ranked[0]?.componentScores.recencyBoost).toBeGreaterThan(1);
  });

  it('ranks exact title matches higher with exactTitleBoost', () => {
    const ranked = rankHybridDefaultV1(
      [
        {
          chunkId: 'other',
          keywordRank: 1,
          nodeTitle: 'Other Topic',
          query: 'Alpha Guide',
        },
        {
          chunkId: 'match',
          keywordRank: 2,
          nodeTitle: 'Alpha Guide',
          query: 'Alpha Guide',
        },
      ],
      { exactTitleBoost: 1 },
    );
    expect(ranked[0]?.chunkId).toBe('match');
    expect(ranked[0]?.componentScores.exactTitleBoost).toBe(2);
  });
});
