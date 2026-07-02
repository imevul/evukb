export type SyncEnqueueResponse = {
  enqueued: boolean;
  jobId?: string | null;
};

export type SyncStatus = {
  lastSyncAt?: string;
  lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed';
  lastSyncError?: string;
  lastCommitSha?: string;
};
