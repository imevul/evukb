import { randomUUID } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { usageRoutesPlugin } from '../src/routes/usage-routes.js';

const workspaceId = randomUUID();

function usageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    workspaceId,
    corpusId: null,
    nodeId: null,
    operationType: 'embedding',
    provider: 'openai',
    model: 'text-embedding-3-small',
    inputTokens: 12,
    outputTokens: null,
    characterCount: 48,
    chunkCount: 1,
    requestCount: 1,
    latencyMs: 25,
    estimatedCost: '0.000010',
    currency: 'USD',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function buildServer(usageRecords: {
  listRecentByWorkspace: ReturnType<typeof vi.fn>;
  aggregateByWorkspace: ReturnType<typeof vi.fn>;
}) {
  const server = Fastify();
  server.decorateRequest('evuKbWorkspace', null);
  server.addHook('onRequest', async (request) => {
    request.evuKbWorkspace = {
      id: workspaceId,
      slug: 'test',
      name: 'Test',
    } as typeof request.evuKbWorkspace;
  });
  await server.register(usageRoutesPlugin, {
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake for route test
    usageRecords: usageRecords as any,
  });
  return server;
}

describe('usage routes', () => {
  it('lists recent usage with the default limit and drops null fields', async () => {
    const listRecentByWorkspace = vi.fn(async () => [usageRow()]);
    const aggregateByWorkspace = vi.fn(async () => []);
    const server = await buildServer({ listRecentByWorkspace, aggregateByWorkspace });

    const response = await server.inject({ method: 'GET', url: '/usage/recent' });

    expect(response.statusCode).toBe(200);
    expect(listRecentByWorkspace).toHaveBeenCalledWith(workspaceId, 20);
    const [record] = response.json() as Array<Record<string, unknown>>;
    expect(record.workspaceId).toBe(workspaceId);
    expect(record.estimatedCost).toBe(0.00001);
    expect(record).not.toHaveProperty('corpusId');
    expect(record).not.toHaveProperty('nodeId');
    expect(record).not.toHaveProperty('outputTokens');
    await server.close();
  });

  it('clamps the recent limit into the 1..200 range', async () => {
    const listRecentByWorkspace = vi.fn(async () => []);
    const aggregateByWorkspace = vi.fn(async () => []);
    const server = await buildServer({ listRecentByWorkspace, aggregateByWorkspace });

    await server.inject({ method: 'GET', url: '/usage/recent?limit=9999' });
    expect(listRecentByWorkspace).toHaveBeenLastCalledWith(workspaceId, 200);

    await server.inject({ method: 'GET', url: '/usage/recent?limit=-3' });
    expect(listRecentByWorkspace).toHaveBeenLastCalledWith(workspaceId, 1);

    await server.inject({ method: 'GET', url: '/usage/recent?limit=abc' });
    expect(listRecentByWorkspace).toHaveBeenLastCalledWith(workspaceId, 20);
    await server.close();
  });

  it('passes summary filters through and returns aggregate rows', async () => {
    const listRecentByWorkspace = vi.fn(async () => []);
    const aggregateByWorkspace = vi.fn(async () => [
      { operationType: 'embedding', requestCount: 3, estimatedCost: 0.01 },
    ]);
    const server = await buildServer({ listRecentByWorkspace, aggregateByWorkspace });

    const since = '2026-01-01T00:00:00.000Z';
    const until = '2026-02-01T00:00:00.000Z';
    const response = await server.inject({
      method: 'GET',
      url: `/usage/summary?since=${since}&until=${until}&operationType=embedding&groupBy=operationType`,
    });

    expect(response.statusCode).toBe(200);
    expect(aggregateByWorkspace).toHaveBeenCalledWith(workspaceId, {
      since,
      until,
      operationType: 'embedding',
      groupBy: 'operationType',
    });
    expect(response.json()).toHaveLength(1);
    await server.close();
  });

  it('rejects invalid summary query parameters with 400s', async () => {
    const listRecentByWorkspace = vi.fn(async () => []);
    const aggregateByWorkspace = vi.fn(async () => []);
    const server = await buildServer({ listRecentByWorkspace, aggregateByWorkspace });

    const badSince = await server.inject({
      method: 'GET',
      url: '/usage/summary?since=not-a-date',
    });
    expect(badSince.statusCode).toBe(400);

    const badUntil = await server.inject({
      method: 'GET',
      url: '/usage/summary?until=whenever',
    });
    expect(badUntil.statusCode).toBe(400);

    const badGroupBy = await server.inject({
      method: 'GET',
      url: '/usage/summary?groupBy=provider',
    });
    expect(badGroupBy.statusCode).toBe(400);
    expect(aggregateByWorkspace).not.toHaveBeenCalled();
    await server.close();
  });
});
