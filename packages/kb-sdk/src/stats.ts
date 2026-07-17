export type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'stale' | 'failed';

export type CorpusLinkCounts = {
  total: number;
  internal: number;
  resolved: number;
  unresolved: number;
};

export type IndexStatusCounts = Record<IndexStatus, number>;

export type KnowledgeCorpusStats = {
  corpusId: string;
  workspaceId: string;
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
    lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed' | 'writeback_blocked';
    lastSyncError?: string;
    lastCommitSha?: string;
    lastWritebackAt?: string;
    lastWritebackError?: string;
  };
  warnings: string[];
  updatedAt: string;
};
