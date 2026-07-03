import type { RankingStrategyRegistry } from '@evu/kb-core';

import { ApiError } from '../errors.js';

export function assertValidRankingStrategyId(
  registry: RankingStrategyRegistry,
  rankingStrategyId: string | undefined,
): void {
  if (rankingStrategyId === undefined) {
    return;
  }
  try {
    registry.resolve(rankingStrategyId);
  } catch {
    throw ApiError.validation(`Unknown ranking strategy: ${rankingStrategyId}`);
  }
}
