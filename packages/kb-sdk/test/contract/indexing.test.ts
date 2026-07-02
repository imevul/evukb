import { describe, expect, it } from 'vitest';

import {
  apiErrorCases,
  BASE_URL,
  CORPUS,
  createHarness,
  drain,
  expectApiError,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  parseJsonBody,
  sseResponse,
  WS,
} from './harness.js';

const corpusBase = `${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}`;
const enqueueResponse = { enqueued: 2, nodeIds: ['node-1', 'node-2'] };

describe('indexing contract', () => {
  it('reindexNodes issues POST .../reindex with nodeIds body', async () => {
    const harness = createHarness(() => jsonResponse(enqueueResponse));
    await expect(harness.client.reindexNodes(WS, CORPUS, ['node-1', 'node-2'])).resolves.toEqual(
      enqueueResponse,
    );
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/reindex`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual({ nodeIds: ['node-1', 'node-2'] });
  });

  it('reindexCorpus issues POST .../reindex-all without body', async () => {
    const harness = createHarness(() => jsonResponse(enqueueResponse));
    await harness.client.reindexCorpus(WS, CORPUS);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/reindex-all`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('reindexNeedingAttention issues POST .../reindex-needing without body', async () => {
    const harness = createHarness(() => jsonResponse(enqueueResponse));
    await harness.client.reindexNeedingAttention(WS, CORPUS);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/reindex-needing`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('validateCitations issues POST .../validate-citations without body', async () => {
    const harness = createHarness(() => jsonResponse({ enqueued: 4 }));
    await expect(harness.client.validateCitations(WS, CORPUS)).resolves.toEqual({ enqueued: 4 });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/validate-citations`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('subscribeCorpusIndexEvents streams GET .../index-events as SSE', async () => {
    const payload =
      'event: index\ndata: {"kind":"node_status","nodeId":"node-1","indexStatus":"indexed","previousIndexStatus":"indexing","at":"2026-01-01T00:00:00.000Z"}\n\n';
    const harness = createHarness(() => sseResponse(payload));
    const events = await drain(harness.client.subscribeCorpusIndexEvents(WS, CORPUS));
    expect(events).toEqual([
      {
        kind: 'node_status',
        nodeId: 'node-1',
        indexStatus: 'indexed',
        previousIndexStatus: 'indexing',
        at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/index-events`);
    expect(request.method).toBe('GET');
    expect(request.headers.get('accept')).toBe('text/event-stream');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
  });

  it('subscribeCorpusIndexEvents surfaces JSON API errors as EvuKbApiError', async () => {
    const harness = createHarness(() =>
      jsonResponse({ error: 'Corpus not found.', code: 'not_found' }, 404),
    );
    await expectApiError(drain(harness.client.subscribeCorpusIndexEvents(WS, CORPUS)), {
      status: 404,
      code: 'not_found',
      message: 'Corpus not found.',
    });
  });

  it.each(
    apiErrorCases([
      ['reindexNodes', (client) => client.reindexNodes(WS, CORPUS, ['n'])],
      ['reindexCorpus', (client) => client.reindexCorpus(WS, CORPUS)],
      ['reindexNeedingAttention', (client) => client.reindexNeedingAttention(WS, CORPUS)],
      ['validateCitations', (client) => client.validateCitations(WS, CORPUS)],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
