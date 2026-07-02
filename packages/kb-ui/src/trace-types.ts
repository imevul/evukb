export type TraceOperationUsage = {
  provider: string;
  model: string;
  operationType: string;
  inputTokens?: number;
  outputTokens?: number;
  requestCount: number;
  latencyMs: number;
  estimatedCost?: number;
  currency?: string;
};

export type TraceRetrievalTrace = {
  query: string;
  strategyId: string;
  candidateCount: number;
  selectedCount: number;
  corpusCount?: number;
};

export type TraceUsedChunk = {
  chunkId: string;
  filePath: string;
  score: number;
  componentScores?: Record<string, number>;
};

export type TraceSearchRanking = {
  strategyId: string;
  strategyVersion: string;
  componentScores: Record<string, number>;
  operationUsage?: TraceOperationUsage;
};
