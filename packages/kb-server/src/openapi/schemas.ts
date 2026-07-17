export const corpusArchiveImportResultSchema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['portable', 'archive'] },
    imported: { type: 'integer' },
    updated: { type: 'integer' },
    skipped: { type: 'integer' },
    linksRestored: { type: 'integer' },
    indexed: { type: 'integer' },
    warnings: { type: 'array', items: { type: 'string' } },
    errors: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'mode',
    'imported',
    'updated',
    'skipped',
    'linksRestored',
    'indexed',
    'warnings',
    'errors',
  ],
};

export const corpusSettingsSchema = {
  type: 'object',
  properties: {
    formatProfile: { type: 'string', enum: ['generic', 'okf'] },
    okfStrict: { type: 'boolean' },
    citationValidationEnabled: { type: 'boolean' },
    importKind: { type: 'string', enum: ['managed', 'mount', 'git'] },
    mountPath: { type: 'string' },
    mountMode: { type: 'string', enum: ['import', 'mount_authoritative', 'import_writeback'] },
    gitRemoteUrl: { type: 'string' },
    syncIntervalMinutes: { type: 'integer' },
    gitCredentialSecretName: { type: 'string' },
  },
};

export const workspaceBootHintsSchema = {
  type: 'object',
  properties: {
    databaseConfigured: { type: 'boolean' },
    blobStoreConfigured: { type: 'boolean' },
    mountAllowlistConfigured: { type: 'boolean' },
    secretsKeyConfigured: { type: 'boolean' },
    mountAuthoritativeEnabled: { type: 'boolean' },
    importWritebackEnabled: { type: 'boolean' },
    gitWritebackEnabled: { type: 'boolean' },
  },
  required: [
    'databaseConfigured',
    'blobStoreConfigured',
    'mountAllowlistConfigured',
    'secretsKeyConfigured',
    'mountAuthoritativeEnabled',
    'importWritebackEnabled',
    'gitWritebackEnabled',
  ],
};

export const rankingStrategySummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    version: { type: 'string' },
  },
  required: ['id', 'version'],
};

export const rankingSettingsSchema = {
  type: 'object',
  properties: {
    keywordWeight: { type: 'number' },
    semanticWeight: { type: 'number' },
    recencyBoost: { type: 'number' },
    okfCitationBoost: { type: 'number' },
    exactTitleBoost: { type: 'number' },
    exactPathBoost: { type: 'number' },
    pathBoosts: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
  },
};

export const rankingSettingsViewSchema = {
  type: 'object',
  properties: {
    strategyId: { type: 'string' },
    settings: rankingSettingsSchema,
    source: { type: 'string', enum: ['env', 'database', 'default'] },
    note: { type: 'string' },
    availableStrategies: {
      type: 'array',
      items: rankingStrategySummarySchema,
    },
  },
  required: ['strategyId', 'settings', 'source', 'note', 'availableStrategies'],
};

export const settingsResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    name: { type: 'string' },
    settings: { type: 'object', additionalProperties: true },
    bootHints: workspaceBootHintsSchema,
    ranking: rankingSettingsViewSchema,
  },
  required: ['id', 'slug', 'name', 'settings', 'bootHints', 'ranking'],
};

export const aiProviderOverridePatchSchema = {
  type: ['object', 'null'],
  properties: {
    model: { type: 'string' },
    baseUrl: { type: 'string' },
  },
};

export const indexEnqueueResponseSchema = {
  type: 'object',
  properties: {
    enqueued: { type: 'integer' },
    nodeIds: { type: 'array', items: { type: 'string' } },
  },
};

export const knowledgeFiltersSchema = {
  type: 'object',
  description:
    'Optional metadata filters. Tags match any listed frontmatter tag; fileTypes accept markdown, md, or mime strings.',
  properties: {
    tags: { type: 'array', items: { type: 'string' } },
    fileTypes: { type: 'array', items: { type: 'string' } },
    okfType: { type: 'string' },
    pathAllowlist: {
      type: 'array',
      items: { type: 'string' },
      description: 'Match file paths under any listed prefix.',
    },
    frontmatter: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description:
        'Frontmatter field matches (case-insensitive). Values may use ? and * wildcards.',
    },
    sourceTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['managed', 'shared_mount', 'git', 'reference', 'import'],
      },
    },
    indexStatus: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['pending', 'indexing', 'indexed', 'stale', 'failed'],
      },
    },
  },
};

export const searchRequestFields = {
  query: { type: 'string' },
  pathPrefix: { type: 'string' },
  limit: { type: 'integer' },
  filters: knowledgeFiltersSchema,
  rankingStrategyId: { type: 'string' },
  rankingSettings: rankingSettingsSchema,
};

export const askRequestFields = {
  question: { type: 'string' },
  nodeId: { type: 'string', format: 'uuid' },
  pathPrefix: { type: 'string' },
  filters: knowledgeFiltersSchema,
  maxContextChunks: { type: 'integer' },
  responseMode: {
    type: 'string',
    enum: ['concise', 'detailed', 'extractive'],
  },
  stream: { type: 'boolean' },
  rankingStrategyId: { type: 'string' },
};
