export type CitationSourceType = 'chunk' | 'document' | 'okf-citation' | 'external-url';

export type Citation = {
  citationId: string;
  corpusId: string;
  nodeId: string;
  chunkId?: string;
  filePath: string;
  headingPath?: string[];
  title?: string;
  quote?: string;
  url?: string;
  sourceType: CitationSourceType;
};
