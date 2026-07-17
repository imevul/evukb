import type { NodeSourceType } from '../runtime.js';

export type ImportKind = 'managed' | 'mount' | 'git';

export type MountSyncMode = 'import' | 'mount_authoritative' | 'import_writeback';

export type SyncStatusValue = 'idle' | 'running' | 'success' | 'failed' | 'writeback_blocked';

export type SyncStatus = {
  lastSyncAt?: string;
  lastSyncStatus?: SyncStatusValue;
  lastSyncError?: string;
  lastCommitSha?: string;
  lastWritebackAt?: string;
  lastWritebackError?: string;
};

export type SyncImportResult = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  indexed: number;
  errors: string[];
};

export type SyncedFileDescriptor = {
  relativePath: string;
  parentPath: string;
  name: string;
  sourceType: NodeSourceType;
  sourceRef: string;
  content: Buffer;
  mimeType: string | null;
};

export type NodeMutability = {
  editable: boolean;
  reason?: string;
};

export type SyncEnqueueResponse = {
  enqueued: boolean;
  jobId?: string | null;
};
