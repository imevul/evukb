import { describe, expect, it } from 'vitest';

import type { UpdateAiProvidersRequest, UpdateSettingsRequest } from '../../src/index.js';
import {
  apiErrorCases,
  BASE_URL,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  parseJsonBody,
  WS,
} from './harness.js';

const settingsResponse = {
  id: WS,
  slug: 'local-dev',
  name: 'Local Dev',
  settings: {},
  bootHints: {},
  ranking: { strategyId: 'default', settings: {}, source: 'default', note: '' },
};

describe('settings contract', () => {
  it('getSettings issues GET /api/workspaces/{workspaceId}/settings', async () => {
    const harness = createHarness(() => jsonResponse(settingsResponse));
    await expect(harness.client.getSettings(WS)).resolves.toEqual(settingsResponse);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/settings`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('updateSettings issues PATCH with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(settingsResponse));
    const body: UpdateSettingsRequest = { name: 'Renamed', settings: { theme: 'dark' } };
    await harness.client.updateSettings(WS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/settings`);
    expect(request.method).toBe('PATCH');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('getAiProviders issues GET /api/workspaces/{workspaceId}/ai/providers', async () => {
    const harness = createHarness(() => jsonResponse({ settings: {}, effective: {} }));
    await harness.client.getAiProviders(WS);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/ai/providers`);
    expect(request.method).toBe('GET');
  });

  it('updateAiProviders issues PATCH with JSON body', async () => {
    const harness = createHarness(() => jsonResponse({ settings: {}, effective: {} }));
    const body: UpdateAiProvidersRequest = {
      embedding: { model: 'test-embed', chunkingStrategy: 'headings' },
      chat: null,
    };
    await harness.client.updateAiProviders(WS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/ai/providers`);
    expect(request.method).toBe('PATCH');
    expect(parseJsonBody(request)).toEqual(body);
  });

  it.each(
    apiErrorCases([
      ['getSettings', (client) => client.getSettings(WS)],
      ['updateSettings', (client) => client.updateSettings(WS, {})],
      ['getAiProviders', (client) => client.getAiProviders(WS)],
      ['updateAiProviders', (client) => client.updateAiProviders(WS, {})],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
