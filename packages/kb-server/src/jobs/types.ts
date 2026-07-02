import type { OkfLogMaintenanceActor } from '@evu/kb-core';

import type { OkfMaintenanceEvent } from '../services/okf-maintenance-types.js';

export type IndexNodeJob = {
  workspaceId: string;
  corpusId: string;
  nodeId: string;
};

export type OkfMaintainJob = {
  workspaceId: string;
  corpusId: string;
  folderPath: string;
  event: OkfMaintenanceEvent;
  actor?: OkfLogMaintenanceActor;
};

export type CitationValidateJob = {
  workspaceId: string;
  corpusId: string;
  nodeId: string;
};

export type MountSyncJob = {
  workspaceId: string;
  corpusId: string;
};

export type GitSyncJob = {
  workspaceId: string;
  corpusId: string;
};

export type CorpusReindexJob = {
  workspaceId: string;
  corpusId: string;
};

export type CorpusJobCounts = {
  pendingJobCount: number;
  failedJobCount: number;
};
