import { defaultRankingStrategyId } from '../runtime.js';
import {
  isOkfCitationSectionHeading,
  resolveExactTitleMultiplier,
  resolveOkfCitationMultiplier,
  resolveRecencyMultiplier,
} from './boosts.js';
import { resolvePathBoost } from './effective-ranking.js';
import type { RankedSearchHit } from './types.js';

export const hybridDefaultStrategyVersion = '1';

export type RankingCandidate = {
  chunkId: string;
  filePath?: string;
  keywordRank?: number;
  keywordScore?: number;
  semanticRank?: number;
  semanticScore?: number;
  indexedAt?: string;
  nodeTitle?: string;
  headingPath?: string[];
  isOkfCitationSection?: boolean;
  query?: string;
};

export type HybridRankingWeights = {
  keywordWeight?: number;
  semanticWeight?: number;
  pathBoosts?: Record<string, number>;
  recencyBoost?: number;
  okfCitationBoost?: number;
  exactTitleBoost?: number;
};

const rrfK = 60;

export function rankHybridDefaultV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): RankedSearchHit[] {
  const keywordWeight = weights.keywordWeight ?? 1;
  const semanticWeight = weights.semanticWeight ?? 1;

  const byId = new Map<string, RankingCandidate>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.chunkId);
    byId.set(candidate.chunkId, existing ? { ...existing, ...candidate } : candidate);
  }

  const hits: RankedSearchHit[] = [];
  for (const candidate of byId.values()) {
    const keywordComponent =
      candidate.keywordRank !== undefined ? 1 / (rrfK + candidate.keywordRank) : 0;
    const semanticComponent =
      candidate.semanticRank !== undefined ? 1 / (rrfK + candidate.semanticRank) : 0;
    const keywordScore = candidate.keywordScore ?? 0;
    const semanticScore = candidate.semanticScore ?? 0;
    const pathBoost = candidate.filePath
      ? resolvePathBoost(candidate.filePath, weights.pathBoosts)
      : 1;
    const weightedKeyword = keywordComponent * keywordWeight;
    const weightedSemantic = semanticComponent * semanticWeight;
    const isCitationSection =
      candidate.isOkfCitationSection ?? isOkfCitationSectionHeading(candidate.headingPath ?? []);
    const recencyMul = resolveRecencyMultiplier(candidate.indexedAt, weights.recencyBoost);
    const okfMul = resolveOkfCitationMultiplier(isCitationSection, weights.okfCitationBoost);
    const titleMul = resolveExactTitleMultiplier(
      candidate.query,
      candidate.nodeTitle,
      weights.exactTitleBoost,
    );
    const score = (weightedKeyword + weightedSemantic) * pathBoost * recencyMul * okfMul * titleMul;
    const matchKind: RankedSearchHit['matchKind'] =
      keywordComponent > 0 && semanticComponent > 0
        ? 'both'
        : semanticComponent > 0
          ? 'semantic'
          : 'keyword';

    hits.push({
      chunkId: candidate.chunkId,
      keywordScore,
      semanticScore,
      score,
      matchKind,
      componentScores: {
        keywordRank: candidate.keywordRank ?? 0,
        semanticRank: candidate.semanticRank ?? 0,
        keywordScore,
        semanticScore,
        rrfKeyword: keywordComponent,
        rrfSemantic: semanticComponent,
        keywordWeight,
        semanticWeight,
        pathBoost,
        weightedKeyword,
        weightedSemantic,
        recencyBoost: recencyMul,
        okfCitationBoost: okfMul,
        exactTitleBoost: titleMul,
        exactPathBoost: 0,
      },
    });
  }

  hits.sort((left, right) => right.score - left.score);
  return hits;
}

export function defaultRankingTrace(componentScores: Record<string, number>) {
  return {
    strategyId: defaultRankingStrategyId,
    strategyVersion: hybridDefaultStrategyVersion,
    componentScores,
  };
}
