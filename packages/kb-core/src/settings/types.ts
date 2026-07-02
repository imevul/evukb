import type { EmbeddingChunkingStrategy } from './chunking.js';

/**
 * Where an effective setting value came from, in precedence order:
 * request → database → config → env → default. The `config` layer (config
 * file) is reserved; no config-file loader ships yet, so it never appears in
 * resolved values today.
 */
export type SettingSource = 'request' | 'database' | 'config' | 'env' | 'default';

export type SettingField<T> = {
  value: T;
  source: SettingSource;
};

export type EffectiveProviderConfig = {
  providerId: string;
  model: string;
  baseUrl: string | null;
  configured: boolean;
  healthStatus: 'ok' | 'not-configured' | 'error';
  healthMessage?: string;
  source?: SettingSource;
  chunkingStrategy?: SettingField<EmbeddingChunkingStrategy>;
  maxChunkTokens?: SettingField<number>;
};

export type AiProviderOverride = {
  model?: string;
  baseUrl?: string;
  chunkingStrategy?: EmbeddingChunkingStrategy;
  maxChunkTokens?: number;
};

export type AiProviderSettings = {
  embedding?: AiProviderOverride | null;
  chat?: AiProviderOverride | null;
};

export type UpdateAiProvidersRequest = AiProviderSettings;

export type AiProvidersView = {
  embedding: EffectiveProviderConfig;
  chat: EffectiveProviderConfig;
};

export type WorkspaceBootHints = {
  databaseConfigured: boolean;
  blobStoreConfigured: boolean;
  mountAllowlistConfigured: boolean;
  secretsKeyConfigured: boolean;
  mountAuthoritativeEnabled: boolean;
  importWritebackEnabled: boolean;
};

export type WorkspaceSettingsView = {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  bootHints: WorkspaceBootHints;
};

export type RankingSettings = {
  keywordWeight?: number;
  semanticWeight?: number;
  recencyBoost?: number;
  okfCitationBoost?: number;
  exactTitleBoost?: number;
  exactPathBoost?: number;
  pathBoosts?: Record<string, number>;
};

export type RankingStrategySummary = {
  id: string;
  version: string;
};

export type RankingSettingsView = {
  strategyId: string;
  settings: RankingSettings;
  source: SettingSource;
  note: string;
  availableStrategies: RankingStrategySummary[];
};

export type SecretRecord = {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
};

export type CreatedSecret = SecretRecord & {
  value: string;
};

export type FailedJobRecord = {
  id: string;
  queueName: string;
  workspaceId: string | null;
  corpusId: string | null;
  nodeId: string | null;
  filePath: string | null;
  failedAt: string;
  errorMessage: string | null;
  output: unknown;
  payload: Record<string, unknown>;
};
