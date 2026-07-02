import type { ChunkId, CorpusId, NodeId, WorkspaceId } from './ids.js';

export type KnowledgeChunk = {
  id: ChunkId;
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  nodeId: NodeId;
  ordinal: number;
  filePath: string;
  folderPath: string;
  headingPath: string[];
  body: string;
  bodyPreview: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
  indexedAt: string;
};
