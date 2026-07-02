import type { CorpusId, WorkspaceId } from '../ids.js';
import type { IndexStatus } from '../runtime.js';

export type CorpusLinkCounts = {
  total: number;
  internal: number;
  resolved: number;
  unresolved: number;
};

export type IndexStatusCounts = Record<IndexStatus, number>;

export const emptyIndexStatusCounts = (): IndexStatusCounts => ({
  pending: 0,
  indexing: 0,
  indexed: 0,
  stale: 0,
  failed: 0,
});

export type KnowledgeCorpusStats = {
  corpusId: CorpusId;
  workspaceId: WorkspaceId;
  fileCount: number;
  chunkCount: number;
  totalBytes: number;
  indexStatusCounts: IndexStatusCounts;
  linkCounts: CorpusLinkCounts;
  okfIssueCount: number;
  citationIssueCount: number;
  pendingJobCount: number;
  failedJobCount: number;
  importKind?: 'managed' | 'mount' | 'git';
  syncStatus?: {
    lastSyncAt?: string;
    lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed';
    lastSyncError?: string;
    lastCommitSha?: string;
  };
  warnings: string[];
  updatedAt: string;
};
