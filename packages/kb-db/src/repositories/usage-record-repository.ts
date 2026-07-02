import type {
  CreateUsageRecordInput,
  UsageAggregateRow,
  UsageOperationType,
  UsageSummaryQuery,
} from '@evu/kb-core';
import { and, count, desc, eq, gte, lte, sum } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { usageRecords } from '../schema/usage.js';

export class UsageRecordRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async create(input: CreateUsageRecordInput): Promise<void> {
    await this.#db.insert(usageRecords).values({
      workspaceId: input.workspaceId,
      corpusId: input.corpusId ?? null,
      nodeId: input.nodeId ?? null,
      operationType: input.operationType,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      characterCount: input.characterCount ?? null,
      chunkCount: input.chunkCount ?? null,
      requestCount: input.requestCount,
      latencyMs: input.latencyMs,
      estimatedCost: input.estimatedCost !== undefined ? String(input.estimatedCost) : null,
      currency: input.currency ?? null,
    });
  }

  async listRecentByWorkspace(workspaceId: string, limit = 20) {
    return this.#db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.workspaceId, workspaceId))
      .orderBy(desc(usageRecords.createdAt))
      .limit(limit);
  }

  async aggregateByWorkspace(
    workspaceId: string,
    query: UsageSummaryQuery = {},
  ): Promise<UsageAggregateRow[]> {
    const conditions = [eq(usageRecords.workspaceId, workspaceId)];
    if (query.since) {
      conditions.push(gte(usageRecords.createdAt, query.since));
    }
    if (query.until) {
      conditions.push(lte(usageRecords.createdAt, query.until));
    }
    if (query.operationType) {
      conditions.push(eq(usageRecords.operationType, query.operationType));
    }

    const groupBy = query.groupBy ?? 'operationType';
    if (groupBy !== 'operationType') {
      throw new Error(`Unsupported usage aggregate groupBy: ${groupBy}`);
    }

    const rows = await this.#db
      .select({
        operationType: usageRecords.operationType,
        recordCount: count(),
        requestCount: sum(usageRecords.requestCount),
        inputTokens: sum(usageRecords.inputTokens),
        outputTokens: sum(usageRecords.outputTokens),
        latencyMs: sum(usageRecords.latencyMs),
      })
      .from(usageRecords)
      .where(and(...conditions))
      .groupBy(usageRecords.operationType);

    return rows.map((row) => ({
      operationType: row.operationType as UsageOperationType,
      recordCount: Number(row.recordCount),
      requestCount: Number(row.requestCount ?? 0),
      inputTokens: Number(row.inputTokens ?? 0),
      outputTokens: Number(row.outputTokens ?? 0),
      latencyMs: Number(row.latencyMs ?? 0),
    }));
  }
}
