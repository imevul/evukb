import { describe, expect, it } from 'vitest';

import type { AskStreamEvent, CorpusAskRequest, WorkspaceAskRequest } from '../../src/index.js';
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

const askResponse = {
  answer: 'Hi',
  citations: [],
  usedChunks: [],
  warnings: [],
  model: 'test-model',
  retrievalTrace: { query: 'q', strategyId: 'default', candidateCount: 1, selectedCount: 1 },
};

const ssePayload =
  'event: ask\ndata: {"type":"token","delta":"Hi"}\n\n' + 'event: ask\ndata: {"type":"done"}\n\n';

describe('ask contract', () => {
  it('ask issues POST .../knowledge-corpora/{corpusId}/ask with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(askResponse));
    const body: CorpusAskRequest = { question: 'Hello?', responseMode: 'concise' };
    await expect(harness.client.ask(WS, CORPUS, body)).resolves.toEqual(askResponse);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}/ask`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('askWorkspace issues POST /api/workspaces/{workspaceId}/ask with corpusIds', async () => {
    const harness = createHarness(() => jsonResponse(askResponse));
    const body: WorkspaceAskRequest = { question: 'Hello?', corpusIds: ['corpus-1'] };
    await expect(harness.client.askWorkspace(WS, body)).resolves.toEqual(askResponse);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/ask`);
    expect(request.method).toBe('POST');
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('askStream POSTs with stream: true and SSE accept header, yields parsed events', async () => {
    const harness = createHarness(() => sseResponse(ssePayload));
    const events = await drain(harness.client.askStream(WS, CORPUS, { question: 'Hello?' }));
    expect(events).toEqual<AskStreamEvent[]>([{ type: 'token', delta: 'Hi' }, { type: 'done' }]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}/ask`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('accept')).toBe('text/event-stream');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
    expect(parseJsonBody(request)).toEqual({ question: 'Hello?', stream: true });
  });

  it('askWorkspaceStream POSTs workspace ask path with stream: true', async () => {
    const harness = createHarness(() => sseResponse(ssePayload));
    const events = await drain(
      harness.client.askWorkspaceStream(WS, { question: 'Hello?', corpusIds: ['corpus-1'] }),
    );
    expect(events).toHaveLength(2);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/ask`);
    expect(parseJsonBody(request)).toEqual({
      question: 'Hello?',
      corpusIds: ['corpus-1'],
      stream: true,
    });
  });

  it('askStream surfaces JSON API errors as EvuKbApiError', async () => {
    const harness = createHarness(() =>
      jsonResponse({ error: 'Chat provider is not configured.', code: 'service_unavailable' }, 503),
    );
    await expectApiError(drain(harness.client.askStream(WS, CORPUS, { question: 'Hi' })), {
      status: 503,
      code: 'service_unavailable',
      message: 'Chat provider is not configured.',
    });
  });

  it.each(
    apiErrorCases([
      ['ask', (client) => client.ask(WS, CORPUS, { question: 'x' })],
      ['askWorkspace', (client) => client.askWorkspace(WS, { question: 'x', corpusIds: [] })],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
