import type { CorpusId, NodeId, WorkspaceId } from './ids.js';
import type { IndexStatus, NodeSourceType, NodeType } from './runtime.js';

export type KnowledgeNode = {
  id: NodeId;
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  parentId: NodeId | null;
  path: string;
  name: string;
  nodeType: NodeType;
  storageRelPath: string | null;
  sourceType: NodeSourceType;
  sourceRef: string | null;
  contentHash: string | null;
  mimeType: string | null;
  sizeBytes: number;
  indexStatus: IndexStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
};
