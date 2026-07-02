export type DatabaseHealth = {
  status: 'ok' | 'error' | 'not-configured';
  migrationsApplied?: number;
};

export type BlobStoreHealth = {
  status: 'ok' | 'error' | 'not-configured';
  root?: string;
};

export type ProviderHealthSummary = {
  embedding: {
    status: 'ok' | 'not-configured' | 'error';
    model?: string;
    message?: string;
  };
  chat: {
    status: 'ok' | 'not-configured' | 'error';
    model?: string;
    message?: string;
  };
};

export type VectorStoreHealth = {
  backend: 'pgvector' | 'qdrant';
  status: 'ok' | 'error' | 'not-configured';
  message?: string;
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

export type ListFailedJobsQuery = {
  limit?: number;
};

export type JobRetryResult = {
  jobId: string;
  queueName: string;
  retried: true;
};

export type JobDeleteResult = {
  jobId: string;
  queueName: string;
  deleted: true;
};
