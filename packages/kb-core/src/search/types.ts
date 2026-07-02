import type { Citation } from '../citation.js';
import type { ChunkId, CorpusId, NodeId, WorkspaceId } from '../ids.js';

import type { RankingSettings } from '../settings/types.js';
import type { OperationUsage } from '../usage/types.js';

import type { KnowledgeFilters } from './filters.js';

export type SearchMatchKind = 'keyword' | 'semantic' | 'both' | 'metadata';

export type SearchRankingTrace = {
  strategyId: string;
  strategyVersion: string;
  componentScores: Record<string, number>;
  operationUsage?: OperationUsage;
};

export type SearchResult = {
  chunkId: ChunkId;
  nodeId: NodeId;
  corpusId: CorpusId;
  workspaceId: WorkspaceId;
  filePath: string;
  headingPath: string[];
  bodyPreview: string;
  score: number;
  matchKind: SearchMatchKind;
  citation: Citation;
  ranking: SearchRankingTrace;
};

export type SearchRequest = {
  query?: string;
  pathPrefix?: string;
  limit?: number;
  filters?: KnowledgeFilters;
  rankingSettings?: RankingSettings;
  rankingStrategyId?: string;
};

export type WorkspaceSearchRequest = {
  query?: string;
  corpusIds: string[];
  pathPrefix?: string;
  limit?: number;
  filters?: KnowledgeFilters;
  rankingSettings?: RankingSettings;
  rankingStrategyId?: string;
};

export type RankedSearchHit = {
  chunkId: string;
  keywordScore: number;
  semanticScore: number;
  score: number;
  matchKind: SearchMatchKind;
  componentScores: Record<string, number>;
};
