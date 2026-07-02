import type { ChunkId, CorpusId, NodeId } from './ids.js';

export type CitationSourceType = 'chunk' | 'document' | 'okf-citation' | 'external-url';

export type Citation = {
  citationId: string;
  corpusId: CorpusId;
  nodeId: NodeId;
  chunkId?: ChunkId;
  filePath: string;
  headingPath?: string[];
  title?: string;
  quote?: string;
  url?: string;
  sourceType: CitationSourceType;
};
