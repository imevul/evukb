import { parseRankingSettings } from '../settings/ranking.js';
import type { RankingSettings } from '../settings/types.js';

export type EffectiveRankingSettings = RankingSettings & {
  keywordWeight: number;
  semanticWeight: number;
};

export type ResolveEffectiveRankingInput = {
  workspaceSettings?: Record<string, unknown>;
  corpusSettings?: Record<string, unknown>;
  requestOverride?: RankingSettings;
};

function mergeRankingLayers(...layers: Array<RankingSettings | undefined>): RankingSettings {
  const merged: RankingSettings = {};
  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    Object.assign(merged, layer);
    if (layer.pathBoosts) {
      merged.pathBoosts = {
        ...(merged.pathBoosts ?? {}),
        ...layer.pathBoosts,
      };
    }
  }
  return merged;
}

export function resolveEffectiveRankingSettings(
  input: ResolveEffectiveRankingInput,
): EffectiveRankingSettings {
  const workspaceRanking = parseRankingSettings(input.workspaceSettings ?? {});
  const corpusRanking = parseRankingSettings(input.corpusSettings ?? {});
  const merged = mergeRankingLayers(workspaceRanking, corpusRanking, input.requestOverride);

  return {
    ...merged,
    keywordWeight: merged.keywordWeight ?? 1,
    semanticWeight: merged.semanticWeight ?? 1,
  };
}

export function resolvePathBoost(
  filePath: string,
  pathBoosts: Record<string, number> | undefined,
): number {
  if (!pathBoosts || Object.keys(pathBoosts).length === 0) {
    return 1;
  }

  let bestPrefix = '';
  let bestBoost = 1;
  for (const [prefix, boost] of Object.entries(pathBoosts)) {
    if (!prefix || typeof boost !== 'number' || !Number.isFinite(boost)) {
      continue;
    }
    const normalized = prefix.startsWith('/') ? prefix.slice(1) : prefix;
    if (filePath.startsWith(normalized) && normalized.length > bestPrefix.length) {
      bestPrefix = normalized;
      bestBoost = boost;
    }
  }

  return bestBoost;
}
