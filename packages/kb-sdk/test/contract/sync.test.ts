import { describe, expect, it } from 'vitest';

import {
  apiErrorCases,
  BASE_URL,
  CORPUS,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const corpusBase = `${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}`;

describe('sync contract', () => {
  it('syncMount issues POST .../sync-mount without body', async () => {
    const harness = createHarness(() => jsonResponse({ enqueued: true, jobId: 'job-1' }));
    await expect(harness.client.syncMount(WS, CORPUS)).resolves.toEqual({
      enqueued: true,
      jobId: 'job-1',
    });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/sync-mount`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, false);
    expect(request.body).toBeUndefined();
  });

  it('syncGit issues POST .../sync-git without body', async () => {
    const harness = createHarness(() => jsonResponse({ enqueued: false, jobId: null }));
    await expect(harness.client.syncGit(WS, CORPUS)).resolves.toEqual({
      enqueued: false,
      jobId: null,
    });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/sync-git`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it.each(
    apiErrorCases([
      ['syncMount', (client) => client.syncMount(WS, CORPUS)],
      ['syncGit', (client) => client.syncGit(WS, CORPUS)],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
