import { describe, expect, it } from 'vitest';

import {
  apiErrorCases,
  BASE_URL,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const wsBase = `${BASE_URL}/api/workspaces/${WS}`;

describe('diagnostics contract', () => {
  it.each([
    ['getHealthDb', '/health/db', { status: 'ok', migrationsApplied: 12 }],
    ['getHealthBlobStore', '/health/blob-store', { status: 'ok', root: '/data' }],
    [
      'getHealthProviders',
      '/health/providers',
      { embedding: { status: 'ok' }, chat: { status: 'not-configured' } },
    ],
    ['getHealthVectorStore', '/health/vector-store', { backend: 'pgvector', status: 'ok' }],
  ] as const)('%s issues GET %s', async (method, suffix, payload) => {
    const harness = createHarness(() => jsonResponse(payload));
    await expect(harness.client[method](WS)).resolves.toEqual(payload);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${wsBase}${suffix}`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('listFailedJobs issues GET /jobs/failed without query by default', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await expect(harness.client.listFailedJobs(WS)).resolves.toEqual([]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${wsBase}/jobs/failed`);
    expect(request.method).toBe('GET');
  });

  it('listFailedJobs forwards limit query param', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.listFailedJobs(WS, { limit: 5 });
    expect(harness.lastRequest().url).toBe(`${wsBase}/jobs/failed?limit=5`);
  });

  it('retryFailedJob issues POST /jobs/{jobId}/retry without body', async () => {
    const result = { jobId: 'job-1', queueName: 'index', retried: true };
    const harness = createHarness(() => jsonResponse(result));
    await expect(harness.client.retryFailedJob(WS, 'job one')).resolves.toEqual(result);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${wsBase}/jobs/job%20one/retry`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('deleteFailedJob issues DELETE /jobs/{jobId}', async () => {
    const result = { jobId: 'job-1', queueName: 'index', deleted: true };
    const harness = createHarness(() => jsonResponse(result));
    await expect(harness.client.deleteFailedJob(WS, 'job-1')).resolves.toEqual(result);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${wsBase}/jobs/job-1`);
    expect(request.method).toBe('DELETE');
  });

  it.each(
    apiErrorCases([
      ['getHealthDb', (client) => client.getHealthDb(WS)],
      ['getHealthBlobStore', (client) => client.getHealthBlobStore(WS)],
      ['getHealthProviders', (client) => client.getHealthProviders(WS)],
      ['getHealthVectorStore', (client) => client.getHealthVectorStore(WS)],
      ['listFailedJobs', (client) => client.listFailedJobs(WS)],
      ['retryFailedJob', (client) => client.retryFailedJob(WS, 'j')],
      ['deleteFailedJob', (client) => client.deleteFailedJob(WS, 'j')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
