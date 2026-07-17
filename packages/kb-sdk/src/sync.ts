export type SyncEnqueueResponse = {
  enqueued: boolean;
  jobId?: string | null;
};

export type SyncStatus = {
  lastSyncAt?: string;
  lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed' | 'writeback_blocked';
  lastSyncError?: string;
  lastCommitSha?: string;
  lastWritebackAt?: string;
  lastWritebackError?: string;
};
