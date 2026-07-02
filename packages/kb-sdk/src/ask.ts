import type { Citation } from './citation.js';
import type { KnowledgeFilters } from './filters.js';
import type { SearchResult } from './search.js';
import type { OperationUsage } from './usage.js';

export type AskResponseMode = 'concise' | 'detailed' | 'extractive';

export type CorpusAskRequest = {
  question: string;
  nodeId?: string;
  pathPrefix?: string;
  filters?: KnowledgeFilters;
  maxContextChunks?: number;
  responseMode?: AskResponseMode;
  stream?: boolean;
  rankingStrategyId?: string;
};

export type WorkspaceAskRequest = {
  question: string;
  corpusIds: string[];
  nodeId?: string;
  pathPrefix?: string;
  filters?: KnowledgeFilters;
  maxContextChunks?: number;
  responseMode?: AskResponseMode;
  stream?: boolean;
  rankingStrategyId?: string;
};

export type RetrievalTrace = {
  query: string;
  strategyId: string;
  candidateCount: number;
  selectedCount: number;
  corpusCount?: number;
};

export type { SearchResult } from './search.js';

export type AskResponse = {
  answer: string;
  citations: Citation[];
  usedChunks: SearchResult[];
  warnings: string[];
  model: string;
  retrievalTrace: RetrievalTrace;
  operationUsage?: OperationUsage;
};

export type AskStreamMetadataEvent = {
  type: 'metadata';
  citations: Citation[];
  usedChunks: SearchResult[];
  warnings: string[];
  model: string;
  retrievalTrace: RetrievalTrace;
};

export type AskStreamTokenEvent = {
  type: 'token';
  delta: string;
};

export type AskStreamDoneEvent = {
  type: 'done';
  operationUsage?: OperationUsage;
};

export type AskStreamEvent = AskStreamMetadataEvent | AskStreamTokenEvent | AskStreamDoneEvent;
