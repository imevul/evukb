import type { CorpusId, WorkspaceId } from './ids.js';

export type KnowledgeCorpus = {
  id: CorpusId;
  workspaceId: WorkspaceId;
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

export type CreateKnowledgeCorpusInput = {
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  settings?: Record<string, unknown>;
  rankingStrategyId?: string;
};

export type UpdateKnowledgeCorpusInput = {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
  rankingStrategyId?: string;
};
