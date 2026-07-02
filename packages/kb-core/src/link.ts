import type { CorpusId, NodeId, WorkspaceId } from './ids.js';
import type { LinkKind } from './runtime.js';

export type KnowledgeLink = {
  id: string;
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  fromNodeId: NodeId;
  toNodeId: NodeId | null;
  linkKind: LinkKind;
  raw: string;
  targetPath: string | null;
  externalUrl: string | null;
  resolved: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};
