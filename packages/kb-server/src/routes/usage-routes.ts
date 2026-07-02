import type { UsageAggregateRow, UsageOperationType, UsageRecord } from '@evu/kb-core';
import type { UsageRecordRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';

export type UsageRoutesOptions = {
  usageRecords: UsageRecordRepository;
};

function mapUsageRecord(
  row: Awaited<ReturnType<UsageRecordRepository['listRecentByWorkspace']>>[number],
): UsageRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ...(row.corpusId ? { corpusId: row.corpusId } : {}),
    ...(row.nodeId ? { nodeId: row.nodeId } : {}),
    operationType: row.operationType as UsageOperationType,
    provider: row.provider,
    model: row.model,
    ...(row.inputTokens !== null ? { inputTokens: row.inputTokens } : {}),
    ...(row.outputTokens !== null ? { outputTokens: row.outputTokens } : {}),
    ...(row.characterCount !== null ? { characterCount: row.characterCount } : {}),
    ...(row.chunkCount !== null ? { chunkCount: row.chunkCount } : {}),
    requestCount: row.requestCount,
    latencyMs: row.latencyMs,
    ...(row.estimatedCost !== null ? { estimatedCost: Number(row.estimatedCost) } : {}),
    ...(row.currency ? { currency: row.currency } : {}),
    createdAt: row.createdAt,
  };
}

export const usageRoutesPlugin: FastifyPluginAsync<UsageRoutesOptions> = async (
  server,
  options,
) => {
  server.get<{ Querystring: { limit?: string } }>('/usage/recent', async (request) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 20;
    const rows = await options.usageRecords.listRecentByWorkspace(
      request.evuKbWorkspace.id,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 20,
    );
    return rows.map(mapUsageRecord);
  });

  server.get<{
    Querystring: {
      since?: string;
      until?: string;
      operationType?: UsageOperationType;
      groupBy?: 'operationType';
    };
  }>('/usage/summary', async (request) => {
    const { since, until, operationType, groupBy } = request.query;
    if (since && Number.isNaN(Date.parse(since))) {
      throw ApiError.validation('since must be a valid ISO-8601 timestamp.');
    }
    if (until && Number.isNaN(Date.parse(until))) {
      throw ApiError.validation('until must be a valid ISO-8601 timestamp.');
    }
    if (groupBy && groupBy !== 'operationType') {
      throw ApiError.validation('groupBy must be operationType when provided.');
    }

    const summary: UsageAggregateRow[] = await options.usageRecords.aggregateByWorkspace(
      request.evuKbWorkspace.id,
      {
        ...(since ? { since } : {}),
        ...(until ? { until } : {}),
        ...(operationType ? { operationType } : {}),
        ...(groupBy ? { groupBy } : {}),
      },
    );
    return summary;
  });
};
