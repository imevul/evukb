import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createDb,
  migrateLatest,
  resolveDatabaseUrl,
  UsageRecordRepository,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb('UsageRecordRepository', () => {
  it('persists embed usage scoped to workspace', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const usageRecords = new UsageRecordRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const corpusId = randomUUID();
      const nodeId = randomUUID();

      await usageRecords.create({
        workspaceId: workspaceA.id,
        corpusId,
        nodeId,
        operationType: 'embed',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        inputTokens: 42,
        characterCount: 120,
        chunkCount: 3,
        requestCount: 1,
        latencyMs: 15,
      });
      await usageRecords.create({
        workspaceId: workspaceB.id,
        operationType: 'embed',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        requestCount: 1,
        latencyMs: 5,
      });

      const recent = await usageRecords.listRecentByWorkspace(workspaceA.id);
      expect(recent).toHaveLength(1);
      expect(recent[0]).toMatchObject({
        workspaceId: workspaceA.id,
        corpusId,
        nodeId,
        operationType: 'embed',
        inputTokens: 42,
        chunkCount: 3,
      });
    } finally {
      await handle.close();
    }
  });

  it('aggregates usage by operation type within a workspace', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const usageRecords = new UsageRecordRepository(handle);

      const workspace = await workspaces.create({
        slug: `ws-agg-${randomUUID()}`,
        name: 'Aggregate Workspace',
      });

      await usageRecords.create({
        workspaceId: workspace.id,
        operationType: 'ask',
        provider: 'openai-compatible',
        model: 'gpt-test',
        inputTokens: 10,
        outputTokens: 5,
        requestCount: 1,
        latencyMs: 100,
      });
      await usageRecords.create({
        workspaceId: workspace.id,
        operationType: 'rerank',
        provider: 'openai-compatible',
        model: 'gpt-test',
        inputTokens: 20,
        outputTokens: 2,
        requestCount: 1,
        latencyMs: 50,
      });
      await usageRecords.create({
        workspaceId: workspace.id,
        operationType: 'ask',
        provider: 'openai-compatible',
        model: 'gpt-test',
        inputTokens: 3,
        outputTokens: 1,
        requestCount: 1,
        latencyMs: 25,
      });

      const summary = await usageRecords.aggregateByWorkspace(workspace.id, {
        groupBy: 'operationType',
      });
      summary.sort((left, right) => left.operationType.localeCompare(right.operationType));

      expect(summary).toEqual([
        {
          operationType: 'ask',
          recordCount: 2,
          requestCount: 2,
          inputTokens: 13,
          outputTokens: 6,
          latencyMs: 125,
        },
        {
          operationType: 'rerank',
          recordCount: 1,
          requestCount: 1,
          inputTokens: 20,
          outputTokens: 2,
          latencyMs: 50,
        },
      ]);
    } finally {
      await handle.close();
    }
  });
});
