export type KnowledgeFormatProfile = 'generic' | 'okf';

export type KnowledgeCorpusSettings = {
  formatProfile?: KnowledgeFormatProfile;
  okfStrict?: boolean;
  importKind?: 'managed' | 'mount' | 'git';
  mountPath?: string;
  mountMode?: 'import' | 'mount_authoritative' | 'import_writeback';
  gitRemoteUrl?: string;
  syncIntervalMinutes?: number;
  gitCredentialSecretName?: string;
  rankingSettings?: Record<string, unknown>;
  agentMutationApprovalPolicy?: Record<string, unknown>;
};

export type KnowledgeCorpus = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  settings: Record<string, unknown>;
  embeddingProviderId: string | null;
  embeddingModelId: string | null;
  rankingStrategyId: string;
  fileCount: number;
  chunkCount: number;
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCorpusRequest = {
  name: string;
  description?: string;
  settings?: KnowledgeCorpusSettings;
};

export type UpdateCorpusRequest = {
  name?: string;
  description?: string;
  settings?: KnowledgeCorpusSettings;
  rankingStrategyId?: string;
};
