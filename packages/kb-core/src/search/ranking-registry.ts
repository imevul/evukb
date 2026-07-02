import { defaultRankingStrategyId } from '../runtime.js';

import {
  type HybridRankingWeights,
  hybridDefaultStrategyVersion,
  type RankingCandidate,
  rankHybridDefaultV1,
} from './ranking.js';
import type { RankedSearchHit } from './types.js';

export type RankingRetrievalProfile = {
  keyword: boolean;
  semantic: boolean;
};

export type RankingPostRank = 'llm';

export type RankingStrategy = {
  id: string;
  version: string;
  retrieval: RankingRetrievalProfile;
  rank: (candidates: RankingCandidate[], weights?: HybridRankingWeights) => RankedSearchHit[];
  postRank?: RankingPostRank;
};

export const rerankerLlmStrategyId = 'reranker_llm';
export const defaultLlmRerankCandidateLimit = 20;

export type RankingStrategyRegistry = {
  get: (strategyId: string) => RankingStrategy | undefined;
  resolve: (strategyId: string) => RankingStrategy;
  list: () => RankingStrategy[];
};

export const semanticOnlyStrategyId = 'semantic_only';
export const keywordOnlyStrategyId = 'keyword_only';
export const recencyBoostedStrategyId = 'recency_boosted';
export const citationBoostedStrategyId = 'citation_boosted';

const rerankerLlmStrategyVersion = '1';

const semanticOnlyStrategyVersion = '1';
const keywordOnlyStrategyVersion = '1';
const recencyBoostedStrategyVersion = '1';
const citationBoostedStrategyVersion = '1';

const recencyBoostedDefaultBoost = 2;
const citationBoostedDefaultBoost = 2;

function rankSemanticOnlyV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): RankedSearchHit[] {
  return rankHybridDefaultV1(candidates, { ...weights, keywordWeight: 0 });
}

function rankKeywordOnlyV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): RankedSearchHit[] {
  return rankHybridDefaultV1(candidates, { ...weights, semanticWeight: 0 });
}

function rankRecencyBoostedV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): RankedSearchHit[] {
  return rankHybridDefaultV1(candidates, {
    ...weights,
    recencyBoost: weights.recencyBoost ?? recencyBoostedDefaultBoost,
  });
}

function rankCitationBoostedV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): RankedSearchHit[] {
  return rankHybridDefaultV1(candidates, {
    ...weights,
    okfCitationBoost: weights.okfCitationBoost ?? citationBoostedDefaultBoost,
  });
}

export function createDefaultRankingStrategyRegistry(): RankingStrategyRegistry {
  const strategies = new Map<string, RankingStrategy>([
    [
      defaultRankingStrategyId,
      {
        id: defaultRankingStrategyId,
        version: hybridDefaultStrategyVersion,
        retrieval: { keyword: true, semantic: true },
        rank: rankHybridDefaultV1,
      },
    ],
    [
      semanticOnlyStrategyId,
      {
        id: semanticOnlyStrategyId,
        version: semanticOnlyStrategyVersion,
        retrieval: { keyword: false, semantic: true },
        rank: rankSemanticOnlyV1,
      },
    ],
    [
      keywordOnlyStrategyId,
      {
        id: keywordOnlyStrategyId,
        version: keywordOnlyStrategyVersion,
        retrieval: { keyword: true, semantic: false },
        rank: rankKeywordOnlyV1,
      },
    ],
    [
      recencyBoostedStrategyId,
      {
        id: recencyBoostedStrategyId,
        version: recencyBoostedStrategyVersion,
        retrieval: { keyword: true, semantic: true },
        rank: rankRecencyBoostedV1,
      },
    ],
    [
      citationBoostedStrategyId,
      {
        id: citationBoostedStrategyId,
        version: citationBoostedStrategyVersion,
        retrieval: { keyword: true, semantic: true },
        rank: rankCitationBoostedV1,
      },
    ],
    [
      rerankerLlmStrategyId,
      {
        id: rerankerLlmStrategyId,
        version: rerankerLlmStrategyVersion,
        retrieval: { keyword: true, semantic: true },
        rank: rankHybridDefaultV1,
        postRank: 'llm',
      },
    ],
  ]);

  return {
    get(strategyId: string) {
      return strategies.get(strategyId);
    },
    resolve(strategyId: string) {
      const strategy = strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Unknown ranking strategy: ${strategyId}`);
      }
      return strategy;
    },
    list() {
      return [...strategies.values()];
    },
  };
}

export const defaultRankingStrategyRegistry = createDefaultRankingStrategyRegistry();

export const activeRankingStrategyIds = defaultRankingStrategyRegistry
  .list()
  .map((strategy) => strategy.id);

export const futureRankingStrategyIds = [] as const;
