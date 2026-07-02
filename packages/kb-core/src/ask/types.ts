import type { Citation } from '../citation.js';
import { maxMultiCorpora } from '../limits.js';
import type { KnowledgeFilters } from '../search/filters.js';
import type { SearchResult } from '../search/types.js';
import type { OperationUsage } from '../usage/types.js';

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

export const maxAskCorpora = maxMultiCorpora;

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

export const defaultMaxContextChunks = 8;

export const weakEvidenceScoreThreshold = 0.05;
