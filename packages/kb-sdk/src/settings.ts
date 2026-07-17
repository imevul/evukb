export type SettingSource = 'env' | 'database' | 'default';

export type WorkspaceBootHints = {
  databaseConfigured: boolean;
  blobStoreConfigured: boolean;
  mountAllowlistConfigured: boolean;
  secretsKeyConfigured: boolean;
  mountAuthoritativeEnabled: boolean;
  importWritebackEnabled: boolean;
  gitWritebackEnabled: boolean;
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
  label?: string;
  description?: string;
  requiresEmbedding?: boolean;
  requiresChatProvider?: boolean;
  builtin?: boolean;
};

export type RankingSettingsView = {
  strategyId: string;
  settings: RankingSettings;
  source: SettingSource;
  note: string;
  availableStrategies: RankingStrategySummary[];
};

export type RankingStrategyUsageView = {
  strategyId: string;
  workspaceDefaultUsesStrategy: boolean;
  corpora: Array<{ id: string; name: string }>;
};

export type RankingStrategiesListResponse = {
  strategies: RankingStrategySummary[];
};

export type SettingsResponse = WorkspaceSettingsView & {
  ranking: RankingSettingsView;
};

export type UpdateSettingsRequest = {
  name?: string;
  settings?: Record<string, unknown>;
};

export type EmbeddingChunkingStrategy =
  | 'headings'
  | 'headings_subsplit'
  | 'headings_subsplit_capped';

export type SettingField<T> = {
  value: T;
  source: SettingSource;
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

export type AiProvidersView = {
  embedding: EffectiveProviderConfig;
  chat: EffectiveProviderConfig;
};
