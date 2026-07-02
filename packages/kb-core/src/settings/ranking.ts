import type { RankingSettings } from './types.js';

export function parseRankingSettings(settings: Record<string, unknown>): RankingSettings {
  const raw = settings.rankingSettings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const parsed: RankingSettings = {};

  const numericFields = [
    'keywordWeight',
    'semanticWeight',
    'recencyBoost',
    'okfCitationBoost',
    'exactTitleBoost',
    'exactPathBoost',
  ] as const;

  for (const field of numericFields) {
    const value = record[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      parsed[field] = value;
    }
  }

  const pathBoosts = record.pathBoosts;
  if (pathBoosts && typeof pathBoosts === 'object' && !Array.isArray(pathBoosts)) {
    const boosts: Record<string, number> = {};
    for (const [key, value] of Object.entries(pathBoosts)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        boosts[key] = value;
      }
    }
    if (Object.keys(boosts).length > 0) {
      parsed.pathBoosts = boosts;
    }
  }

  return parsed;
}

export function validateRankingSettings(settings: Record<string, unknown>): string | null {
  const raw = settings.rankingSettings;
  if (raw === undefined) {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'settings.rankingSettings must be an object.';
  }

  const record = raw as Record<string, unknown>;
  const numericFields = [
    'keywordWeight',
    'semanticWeight',
    'recencyBoost',
    'okfCitationBoost',
    'exactTitleBoost',
    'exactPathBoost',
  ];

  for (const field of numericFields) {
    const value = record[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      return `settings.rankingSettings.${field} must be a finite number.`;
    }
  }

  const pathBoosts = record.pathBoosts;
  if (pathBoosts !== undefined) {
    if (!pathBoosts || typeof pathBoosts !== 'object' || Array.isArray(pathBoosts)) {
      return 'settings.rankingSettings.pathBoosts must be an object.';
    }
    for (const [key, value] of Object.entries(pathBoosts)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `settings.rankingSettings.pathBoosts.${key} must be a finite number.`;
      }
    }
  }

  return null;
}

export function mergeRankingSettings(
  existing: Record<string, unknown>,
  rankingSettings: RankingSettings,
): Record<string, unknown> {
  return {
    ...existing,
    rankingSettings,
  };
}
