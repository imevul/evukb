import type { BlobStore, KnowledgeNode, OkfLogMaintenanceActor } from '@evu/kb-core';
import type { AuditLogRepository, CorpusRepository, NodeRepository } from '@evu/kb-db';

import type { CorpusIndexEventHub } from '../corpus-index-event-hub.js';
import type { GitWritebackService } from '../git-writeback-service.js';
import type { MountWritebackService } from '../mount-writeback-service.js';
import type { OkfMaintenanceEvent } from '../okf-maintenance-types.js';

export type FileManagerDeps = {
  auditLog?: AuditLogRepository;
  blobStore: BlobStore;
  corpora: CorpusRepository;
  indexEventHub?: CorpusIndexEventHub;
  nodes: NodeRepository;
  mountWriteback?: MountWritebackService;
  gitWriteback?: GitWritebackService;
  onContentChanged?: (input: {
    workspaceId: string;
    corpusId: string;
    nodeId: string;
  }) => void | Promise<void>;
  onOkfMutation?: (input: {
    workspaceId: string;
    corpusId: string;
    event: OkfMaintenanceEvent;
    actor: OkfLogMaintenanceActor;
  }) => void | Promise<void>;
};

export type FileMutationContext = {
  internal?: boolean;
  okfActor?: OkfLogMaintenanceActor;
  /** When set, the mutation is recorded in the workspace audit log with this actor. */
  auditActor?: Record<string, unknown>;
};

export type FileContentInput = {
  content: Buffer;
  mimeType?: string | null;
};

export type NodeTreeEntry = KnowledgeNode & {
  children: NodeTreeEntry[];
};
