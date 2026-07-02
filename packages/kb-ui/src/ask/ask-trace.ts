import type { AskResponse, OperationUsage, SearchResult } from '@evu/kb-sdk';

import type { TraceOperationUsage, TraceUsedChunk } from '../trace-types.js';

export function mapOperationUsage(usage?: OperationUsage): TraceOperationUsage | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    provider: usage.provider,
    model: usage.model,
    operationType: usage.operationType,
    requestCount: usage.requestCount,
    latencyMs: usage.latencyMs,
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage.estimatedCost !== undefined ? { estimatedCost: usage.estimatedCost } : {}),
    ...(usage.currency ? { currency: usage.currency } : {}),
  };
}

export function mapUsedChunks(chunks: SearchResult[]): TraceUsedChunk[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    filePath: chunk.filePath,
    score: chunk.score,
    ...(Object.keys(chunk.ranking.componentScores).length > 0
      ? { componentScores: chunk.ranking.componentScores }
      : {}),
  }));
}

export function firstRerankUsage(results: SearchResult[]): OperationUsage | undefined {
  for (const result of results) {
    if (result.ranking.operationUsage) {
      return result.ranking.operationUsage;
    }
  }
  return undefined;
}

export function mergeAskStreamDone(
  response: AskResponse,
  operationUsage?: OperationUsage,
): AskResponse {
  if (!operationUsage) {
    return response;
  }
  return { ...response, operationUsage };
}
