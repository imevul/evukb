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

export type RankingPostRank = string;

export type RankingStrategy = {
  id: string;
  version: string;
  label?: string;
  description?: string;
  retrieval: RankingRetrievalProfile;
  rank: (candidates: RankingCandidate[], weights?: HybridRankingWeights) => RankedSearchHit[];
  postRank?: RankingPostRank;
  builtin?: boolean;
};

export const rerankerLlmStrategyId = 'reranker_llm';
export const defaultLlmRerankCandidateLimit = 20;
export const llmPostRankKey = 'llm';

export type RankingStrategyRegistry = {
  register: (strategy: RankingStrategy, options?: { force?: boolean }) => void;
  unregister: (strategyId: string) => void;
  get: (strategyId: string) => RankingStrategy | undefined;
  resolve: (strategyId: string) => RankingStrategy;
  list: () => RankingStrategy[];
  isBuiltin: (strategyId: string) => boolean;
};

export const semanticOnlyStrategyId = 'semantic_only';
export const keywordOnlyStrategyId = 'keyword_only';
export const recencyBoostedStrategyId = 'recency_boosted';
export const citationBoostedStrategyId = 'citation_boosted';

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

export const hybridDefaultV1Strategy: RankingStrategy = {
  id: defaultRankingStrategyId,
  version: hybridDefaultStrategyVersion,
  label: 'Hybrid default',
  description: 'Keyword + semantic RRF hybrid ranking (v1 default).',
  retrieval: { keyword: true, semantic: true },
  rank: rankHybridDefaultV1,
  builtin: true,
};

export const semanticOnlyStrategy: RankingStrategy = {
  id: semanticOnlyStrategyId,
  version: '1',
  label: 'Semantic only',
  description: 'Vector retrieval and semantic RRF only; requires embedding provider.',
  retrieval: { keyword: false, semantic: true },
  rank: rankSemanticOnlyV1,
  builtin: true,
};

export const keywordOnlyStrategy: RankingStrategy = {
  id: keywordOnlyStrategyId,
  version: '1',
  label: 'Keyword only',
  description: 'Postgres FTS keyword retrieval and ranking only.',
  retrieval: { keyword: true, semantic: false },
  rank: rankKeywordOnlyV1,
  builtin: true,
};

export const recencyBoostedStrategy: RankingStrategy = {
  id: recencyBoostedStrategyId,
  version: '1',
  label: 'Recency boosted',
  description: 'Hybrid ranking with default recency boost multiplier.',
  retrieval: { keyword: true, semantic: true },
  rank: rankRecencyBoostedV1,
  builtin: true,
};

export const citationBoostedStrategy: RankingStrategy = {
  id: citationBoostedStrategyId,
  version: '1',
  label: 'Citation boosted',
  description: 'Hybrid ranking with default OKF citation section boost.',
  retrieval: { keyword: true, semantic: true },
  rank: rankCitationBoostedV1,
  builtin: true,
};

export const rerankerLlmStrategy: RankingStrategy = {
  id: rerankerLlmStrategyId,
  version: '1',
  label: 'LLM reranker',
  description: 'Hybrid retrieval followed by LLM post-rank; requires chat provider.',
  retrieval: { keyword: true, semantic: true },
  rank: rankHybridDefaultV1,
  postRank: llmPostRankKey,
  builtin: true,
};

export const builtinRankingStrategies: RankingStrategy[] = [
  hybridDefaultV1Strategy,
  semanticOnlyStrategy,
  keywordOnlyStrategy,
  recencyBoostedStrategy,
  citationBoostedStrategy,
  rerankerLlmStrategy,
];

export const builtinRankingStrategyIds = new Set(
  builtinRankingStrategies.map((strategy) => strategy.id),
);

export class RankingStrategyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RankingStrategyValidationError';
  }
}

export function assertRankingStrategy(strategy: RankingStrategy): void {
  if (!strategy.id?.trim()) {
    throw new RankingStrategyValidationError('Ranking strategy id is required.');
  }
  if (!strategy.version?.trim()) {
    throw new RankingStrategyValidationError('Ranking strategy version is required.');
  }
  if (!strategy.retrieval || typeof strategy.retrieval !== 'object') {
    throw new RankingStrategyValidationError('Ranking strategy retrieval profile is required.');
  }
  if (typeof strategy.rank !== 'function') {
    throw new RankingStrategyValidationError('Ranking strategy rank function is required.');
  }
}

export type CreateRankingStrategyRegistryOptions = {
  includeBuiltins?: boolean;
  extensions?: RankingStrategy[];
};

export function createRankingStrategyRegistry(
  options: CreateRankingStrategyRegistryOptions = {},
): RankingStrategyRegistry {
  const includeBuiltins = options.includeBuiltins ?? true;
  const strategies = new Map<string, RankingStrategy>();

  const seed = [
    ...(includeBuiltins ? builtinRankingStrategies : []),
    ...(options.extensions ?? []),
  ];
  for (const strategy of seed) {
    assertRankingStrategy(strategy);
    strategies.set(strategy.id, strategy);
  }

  return {
    register(strategy, registerOptions) {
      assertRankingStrategy(strategy);
      const existing = strategies.get(strategy.id);
      if (existing && !registerOptions?.force) {
        if (existing.version === strategy.version) {
          throw new RankingStrategyValidationError(
            `Ranking strategy already registered: ${strategy.id}`,
          );
        }
      }
      strategies.set(strategy.id, strategy);
    },
    unregister(strategyId) {
      if (!strategies.has(strategyId)) {
        throw new RankingStrategyValidationError(`Unknown ranking strategy: ${strategyId}`);
      }
      if (builtinRankingStrategyIds.has(strategyId)) {
        throw new RankingStrategyValidationError(
          `Cannot unregister built-in strategy: ${strategyId}`,
        );
      }
      strategies.delete(strategyId);
    },
    get(strategyId) {
      return strategies.get(strategyId);
    },
    resolve(strategyId) {
      const strategy = strategies.get(strategyId);
      if (!strategy) {
        throw new RankingStrategyValidationError(`Unknown ranking strategy: ${strategyId}`);
      }
      return strategy;
    },
    list() {
      return [...strategies.values()];
    },
    isBuiltin(strategyId) {
      return builtinRankingStrategyIds.has(strategyId);
    },
  };
}

/** @deprecated Use createRankingStrategyRegistry(). */
export function createDefaultRankingStrategyRegistry(): RankingStrategyRegistry {
  return createRankingStrategyRegistry();
}

export const defaultRankingStrategyRegistry = createRankingStrategyRegistry();

export const activeRankingStrategyIds = defaultRankingStrategyRegistry
  .list()
  .map((strategy) => strategy.id);

export function toRankingStrategySummary(strategy: RankingStrategy): {
  id: string;
  version: string;
  label?: string;
  description?: string;
  requiresEmbedding: boolean;
  requiresChatProvider: boolean;
  builtin: boolean;
} {
  return {
    id: strategy.id,
    version: strategy.version,
    ...(strategy.label ? { label: strategy.label } : {}),
    ...(strategy.description ? { description: strategy.description } : {}),
    requiresEmbedding: strategy.retrieval.semantic && !strategy.retrieval.keyword,
    requiresChatProvider: strategy.postRank === llmPostRankKey,
    builtin: strategy.builtin === true || builtinRankingStrategyIds.has(strategy.id),
  };
}

export function createPresetRankingStrategy(input: {
  id: string;
  version: string;
  label?: string;
  description?: string;
  retrieval?: RankingRetrievalProfile;
  weights?: HybridRankingWeights;
  postRank?: RankingPostRank;
}): RankingStrategy {
  const retrieval = input.retrieval ?? { keyword: true, semantic: true };
  const presetWeights = input.weights ?? {};
  return {
    id: input.id,
    version: input.version,
    ...(input.label ? { label: input.label } : {}),
    ...(input.description ? { description: input.description } : {}),
    retrieval,
    rank: (candidates, weights) =>
      rankHybridDefaultV1(candidates, { ...presetWeights, ...weights }),
    ...(input.postRank ? { postRank: input.postRank } : {}),
  };
}
