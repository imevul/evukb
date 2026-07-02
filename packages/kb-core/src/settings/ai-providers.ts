import {
  defaultEmbeddingChunkingStrategy,
  defaultMaxChunkTokens,
  isEmbeddingChunkingStrategy,
  maxMaxChunkTokens,
  minMaxChunkTokens,
  parseMaxChunkTokens,
} from './chunking.js';
import type { AiProviderOverride, AiProviderSettings, SettingSource } from './types.js';

function parseOverride(value: unknown, kind: 'embedding' | 'chat'): AiProviderOverride | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entry = value as Record<string, unknown>;
  const parsed: AiProviderOverride = {};
  if (typeof entry.model === 'string' && entry.model.trim()) {
    parsed.model = entry.model.trim();
  }
  if (typeof entry.baseUrl === 'string' && entry.baseUrl.trim()) {
    parsed.baseUrl = entry.baseUrl.trim();
  }
  if (kind === 'embedding') {
    if (
      typeof entry.chunkingStrategy === 'string' &&
      isEmbeddingChunkingStrategy(entry.chunkingStrategy)
    ) {
      parsed.chunkingStrategy = entry.chunkingStrategy;
    }
    const maxChunkTokens = parseMaxChunkTokens(entry.maxChunkTokens);
    if (maxChunkTokens !== undefined) {
      parsed.maxChunkTokens = maxChunkTokens;
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function parseAiProviderSettings(settings: Record<string, unknown>): AiProviderSettings {
  const raw = settings.aiProviders;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const result: AiProviderSettings = {};
  const embedding = parseOverride(record.embedding, 'embedding');
  if (embedding) {
    result.embedding = embedding;
  }
  const chat = parseOverride(record.chat, 'chat');
  if (chat) {
    result.chat = chat;
  }
  return result;
}

function validateOverrideEntry(
  key: 'embedding' | 'chat',
  entry: Record<string, unknown>,
): string | null {
  if (entry.model !== undefined && typeof entry.model !== 'string') {
    return `aiProviders.${key}.model must be a string.`;
  }
  if (entry.baseUrl !== undefined && typeof entry.baseUrl !== 'string') {
    return `aiProviders.${key}.baseUrl must be a string.`;
  }
  if ('apiKey' in entry || 'secret' in entry) {
    return `aiProviders.${key} must not include API keys; use environment variables.`;
  }
  if (key === 'chat') {
    if (entry.chunkingStrategy !== undefined) {
      return 'aiProviders.chat.chunkingStrategy is not supported.';
    }
    if (entry.maxChunkTokens !== undefined) {
      return 'aiProviders.chat.maxChunkTokens is not supported.';
    }
    return null;
  }

  if (entry.chunkingStrategy !== undefined) {
    if (
      typeof entry.chunkingStrategy !== 'string' ||
      !isEmbeddingChunkingStrategy(entry.chunkingStrategy)
    ) {
      return 'aiProviders.embedding.chunkingStrategy is invalid.';
    }
  }
  if (entry.maxChunkTokens !== undefined) {
    const maxChunkTokens = parseMaxChunkTokens(entry.maxChunkTokens);
    if (maxChunkTokens === undefined) {
      return 'aiProviders.embedding.maxChunkTokens must be an integer.';
    }
    if (maxChunkTokens < minMaxChunkTokens || maxChunkTokens > maxMaxChunkTokens) {
      return `aiProviders.embedding.maxChunkTokens must be between ${minMaxChunkTokens} and ${maxMaxChunkTokens}.`;
    }
  }
  return null;
}

export function validateAiProviderSettings(input: unknown): string | null {
  if (input === undefined || input === null) {
    return null;
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return 'aiProviders must be an object.';
  }

  for (const key of ['embedding', 'chat'] as const) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return `aiProviders.${key} must be an object.`;
    }
    const entryError = validateOverrideEntry(key, value as Record<string, unknown>);
    if (entryError) {
      return entryError;
    }
  }

  return null;
}

export function mergeAiProviderSettings(
  existing: Record<string, unknown>,
  patch: AiProviderSettings,
): Record<string, unknown> {
  const current = parseAiProviderSettings(existing);
  const next: AiProviderSettings = { ...current };
  if (patch.embedding !== undefined) {
    if (patch.embedding === null) {
      delete next.embedding;
    } else {
      next.embedding = {
        ...(current.embedding ?? {}),
        ...patch.embedding,
      };
    }
  }
  if (patch.chat !== undefined) {
    if (patch.chat === null) {
      delete next.chat;
    } else {
      next.chat = {
        ...(current.chat ?? {}),
        ...patch.chat,
      };
    }
  }

  return {
    ...existing,
    aiProviders: next,
  };
}

export function aiProviderSource(
  settings: Record<string, unknown>,
  kind: 'embedding' | 'chat',
): SettingSource {
  const parsed = parseAiProviderSettings(settings);
  const override = kind === 'embedding' ? parsed.embedding : parsed.chat;
  if (override?.model || override?.baseUrl) {
    return 'database';
  }
  return 'env';
}

export function embeddingChunkingStrategySource(settings: Record<string, unknown>): SettingSource {
  const override = parseAiProviderSettings(settings).embedding;
  if (override?.chunkingStrategy) {
    return 'database';
  }
  return 'env';
}

export function embeddingMaxChunkTokensSource(settings: Record<string, unknown>): SettingSource {
  const override = parseAiProviderSettings(settings).embedding;
  if (override?.maxChunkTokens !== undefined) {
    return 'database';
  }
  return 'env';
}

export function resolveEmbeddingChunkingStrategyFromSettings(
  settings: Record<string, unknown>,
  env: Record<string, string | undefined>,
): { value: typeof defaultEmbeddingChunkingStrategy; source: SettingSource } {
  const override = parseAiProviderSettings(settings).embedding;
  if (override?.chunkingStrategy) {
    return { value: override.chunkingStrategy, source: 'database' };
  }
  const raw = env.EVUKB_CHUNKING_STRATEGY?.trim();
  if (raw && isEmbeddingChunkingStrategy(raw)) {
    return { value: raw, source: 'env' };
  }
  return { value: defaultEmbeddingChunkingStrategy, source: 'default' };
}

export function resolveMaxChunkTokensFromSettings(
  settings: Record<string, unknown>,
  env: Record<string, string | undefined>,
): { value: number; source: SettingSource } {
  const override = parseAiProviderSettings(settings).embedding;
  if (override?.maxChunkTokens !== undefined) {
    return { value: override.maxChunkTokens, source: 'database' };
  }
  const raw = env.EVUKB_CHUNK_MAX_TOKENS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= minMaxChunkTokens && parsed <= maxMaxChunkTokens) {
      return { value: parsed, source: 'env' };
    }
  }
  return { value: defaultMaxChunkTokens, source: 'default' };
}
