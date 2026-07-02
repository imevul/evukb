import type { SettingSource } from './types.js';

export type ResolvedSetting<T> = { value: T; source: SettingSource };

export type SettingLayer<T> = { source: SettingSource; value: T | undefined };

/**
 * Central layered-settings resolver. Layers are checked in the order given
 * (callers list request → database → config → env); the first defined value
 * wins, otherwise the default applies.
 */
export function resolveSetting<T>(layers: SettingLayer<T>[], defaultValue: T): ResolvedSetting<T> {
  for (const layer of layers) {
    if (layer.value !== undefined) {
      return { value: layer.value, source: layer.source };
    }
  }
  return { value: defaultValue, source: 'default' };
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type RankingStrategyIdLayers = {
  /** Per-request override from the search/ask body. */
  requestStrategyId?: string | undefined;
  /** Corpus-level strategy stored in the database. */
  corpusStrategyId?: string | null | undefined;
  /** Workspace settings record (reads `rankingStrategyId`). */
  workspaceSettings?: Record<string, unknown> | undefined;
  /** EVUKB_RANKING_STRATEGY value from the host environment. */
  envStrategyId?: string | undefined;
};

export function resolveRankingStrategyIdSetting(
  layers: RankingStrategyIdLayers,
  defaultStrategyId: string,
): ResolvedSetting<string> {
  const workspaceStrategyId =
    typeof layers.workspaceSettings?.rankingStrategyId === 'string'
      ? layers.workspaceSettings.rankingStrategyId
      : undefined;

  return resolveSetting(
    [
      { source: 'request', value: nonEmpty(layers.requestStrategyId) },
      { source: 'database', value: nonEmpty(layers.corpusStrategyId) },
      { source: 'database', value: nonEmpty(workspaceStrategyId) },
      { source: 'env', value: nonEmpty(layers.envStrategyId) },
    ],
    defaultStrategyId,
  );
}
