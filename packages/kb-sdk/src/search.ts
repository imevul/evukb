import type { Citation } from './citation.js';
import type { KnowledgeFilters } from './filters.js';
import type { RankingSettings } from './settings.js';
import type { OperationUsage } from './usage.js';

export type SearchRequest = {
  query: string;
  pathPrefix?: string;
  limit?: number;
  filters?: KnowledgeFilters;
  rankingStrategyId?: string;
  rankingSettings?: RankingSettings;
};

export type WorkspaceSearchRequest = {
  query: string;
  corpusIds: string[];
  pathPrefix?: string;
  limit?: number;
  filters?: KnowledgeFilters;
  rankingStrategyId?: string;
  rankingSettings?: RankingSettings;
};

export type SearchMatchKind = 'keyword' | 'semantic' | 'both';

export type SearchRankingTrace = {
  strategyId: string;
  strategyVersion: string;
  componentScores: Record<string, number>;
  operationUsage?: OperationUsage;
};

export type SearchResult = {
  chunkId: string;
  nodeId: string;
  corpusId: string;
  workspaceId: string;
  filePath: string;
  headingPath: string[];
  bodyPreview: string;
  score: number;
  matchKind: SearchMatchKind;
  citation: Citation;
  ranking: SearchRankingTrace;
};
