export type UsageOperationType = 'embed' | 'ask' | 'rerank' | 'index';

export type OperationUsage = {
  provider: string;
  model: string;
  operationType: UsageOperationType;
  inputTokens?: number;
  outputTokens?: number;
  characterCount?: number;
  requestCount: number;
  latencyMs: number;
  estimatedCost?: number;
  currency?: string;
};

export type UsageRecord = OperationUsage & {
  id: string;
  workspaceId: string;
  corpusId?: string;
  nodeId?: string;
  chunkCount?: number;
  createdAt: string;
};

export type CreateUsageRecordInput = Omit<UsageRecord, 'id' | 'createdAt'>;

export type UsageAggregateGroup = 'operationType';

export type UsageAggregateRow = {
  operationType: UsageOperationType;
  recordCount: number;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type UsageSummaryQuery = {
  since?: string;
  until?: string;
  operationType?: UsageOperationType;
  groupBy?: UsageAggregateGroup;
};
