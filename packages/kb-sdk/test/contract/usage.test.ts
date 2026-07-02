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

describe('usage contract', () => {
  it('listUsageRecords issues GET /usage/recent without query by default', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await expect(harness.client.listUsageRecords(WS)).resolves.toEqual([]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/usage/recent`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('listUsageRecords forwards limit query param', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.listUsageRecords(WS, { limit: 25 });
    expect(harness.lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/${WS}/usage/recent?limit=25`,
    );
  });

  it('getUsageSummary issues GET /usage/summary without query by default', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await expect(harness.client.getUsageSummary(WS)).resolves.toEqual([]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/usage/summary`);
    expect(request.method).toBe('GET');
  });

  it('getUsageSummary forwards since, until, operationType, and groupBy', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.getUsageSummary(WS, {
      since: '2026-01-01',
      until: '2026-02-01',
      operationType: 'ask',
      groupBy: 'operationType',
    });
    expect(harness.lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/${WS}/usage/summary?since=2026-01-01&until=2026-02-01&operationType=ask&groupBy=operationType`,
    );
  });

  it.each(
    apiErrorCases([
      ['listUsageRecords', (client) => client.listUsageRecords(WS)],
      ['getUsageSummary', (client) => client.getUsageSummary(WS)],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
