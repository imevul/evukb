import { describe, expect, it } from 'vitest';

import type { CreateCorpusRequest, UpdateCorpusRequest } from '../../src/index.js';
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

const corpus = { id: 'corpus-1', workspaceId: WS, name: 'Docs' };

describe('corpus contract', () => {
  it('listCorpora issues GET /api/workspaces/{workspaceId}/knowledge-corpora', async () => {
    const harness = createHarness(() => jsonResponse([corpus]));
    await expect(harness.client.listCorpora(WS)).resolves.toEqual([corpus]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('createCorpus issues POST with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(corpus, 201));
    const body: CreateCorpusRequest = {
      name: 'Docs',
      description: 'Team docs',
      settings: { formatProfile: 'okf' },
    };
    await expect(harness.client.createCorpus(WS, body)).resolves.toEqual(corpus);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('getCorpus issues GET with encoded corpus id', async () => {
    const harness = createHarness(() => jsonResponse(corpus));
    await harness.client.getCorpus(WS, 'corpus one');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/corpus%20one`);
    expect(request.method).toBe('GET');
  });

  it('updateCorpus issues PATCH with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(corpus));
    const body: UpdateCorpusRequest = { name: 'Renamed', rankingStrategyId: 'default' };
    await harness.client.updateCorpus(WS, 'corpus-1', body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/corpus-1`);
    expect(request.method).toBe('PATCH');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('deleteCorpus issues DELETE and accepts 204', async () => {
    const harness = createHarness(() => new Response(null, { status: 204 }));
    await expect(harness.client.deleteCorpus(WS, 'corpus-1')).resolves.toBeUndefined();
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/corpus-1`);
    expect(request.method).toBe('DELETE');
    expect(request.body).toBeUndefined();
  });

  it('encodes the workspace id in the path', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.listCorpora('ws/one');
    expect(harness.lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws%2Fone/knowledge-corpora`);
  });

  it.each(
    apiErrorCases([
      ['listCorpora', (client) => client.listCorpora(WS)],
      ['createCorpus', (client) => client.createCorpus(WS, { name: 'x' })],
      ['getCorpus', (client) => client.getCorpus(WS, 'c')],
      ['updateCorpus', (client) => client.updateCorpus(WS, 'c', {})],
      ['deleteCorpus', (client) => client.deleteCorpus(WS, 'c')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
