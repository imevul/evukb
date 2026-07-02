import { describe, expect, it } from 'vitest';

import {
  BASE_URL,
  createHarness,
  expectApiError,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
} from './harness.js';

const healthResponse = {
  service: 'evukb-api',
  status: 'ok',
  scope: 'local-dev',
  database: { status: 'ok', migrationsApplied: 12 },
  blobStore: { status: 'ok', root: '/data' },
};

describe('health contract', () => {
  it('health issues GET /health (unscoped) with auth header', async () => {
    const harness = createHarness(() => jsonResponse(healthResponse));
    await expect(harness.client.health()).resolves.toEqual(healthResponse);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/health`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('health surfaces JSON API errors as EvuKbApiError', async () => {
    await expectStandardApiError((client) => client.health());
  });

  it('falls back to internal_error for non-JSON error responses', async () => {
    const harness = createHarness(
      () => new Response('Bad Gateway', { status: 502, headers: { 'content-type': 'text/html' } }),
    );
    await expectApiError(harness.client.health(), {
      status: 502,
      code: 'internal_error',
      message: 'EvuKB request failed with 502',
    });
  });
});
