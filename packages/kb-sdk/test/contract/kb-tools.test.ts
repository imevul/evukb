import { describe, expect, it } from 'vitest';

import type { KbToolRequest } from '../../src/index.js';
import {
  apiErrorCases,
  BASE_URL,
  createHarness,
  drain,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  parseJsonBody,
  sseResponse,
  WS,
} from './harness.js';

const toolsUrl = `${BASE_URL}/api/workspaces/${WS}/tools/kb`;

describe('kb tools contract', () => {
  it('executeKbTool POSTs read actions to /api/workspaces/{workspaceId}/tools/kb', async () => {
    const harness = createHarness(() => jsonResponse({ ok: true, action: 'search', result: [] }));
    const request: KbToolRequest = { action: 'search', corpusId: 'corpus-1', query: 'hello' };
    await expect(harness.client.executeKbTool(WS, request)).resolves.toEqual({
      ok: true,
      action: 'search',
      result: [],
    });
    const recorded = harness.lastRequest();
    expect(recorded.url).toBe(toolsUrl);
    expect(recorded.method).toBe('POST');
    expectJsonRequestHeaders(recorded, true);
    expect(parseJsonBody(recorded)).toEqual(request);
  });

  it('executeKbTool serializes write actions and parses pending-approval responses', async () => {
    const pending = {
      ok: false,
      pendingApproval: true,
      approvalId: 'approval-1',
      preview: { corpusId: 'corpus-1', action: 'create_document', path: 'notes/a.md' },
    };
    const harness = createHarness(() => jsonResponse(pending));
    const request: KbToolRequest = {
      action: 'create_document',
      corpusId: 'corpus-1',
      path: 'notes',
      name: 'a.md',
      body: '# A',
    };
    await expect(harness.client.executeKbTool(WS, request)).resolves.toEqual(pending);
    expect(parseJsonBody(harness.lastRequest())).toEqual(request);
  });

  it('askKbToolStream POSTs ask action with stream: true and SSE accept header', async () => {
    const payload =
      'event: ask\ndata: {"type":"token","delta":"Hi"}\n\nevent: ask\ndata: {"type":"done"}\n\n';
    const harness = createHarness(() => sseResponse(payload));
    const events = await drain(
      harness.client.askKbToolStream(WS, {
        action: 'ask',
        corpusId: 'corpus-1',
        question: 'Hello?',
      }),
    );
    expect(events).toEqual([{ type: 'token', delta: 'Hi' }, { type: 'done' }]);
    const request = harness.lastRequest();
    expect(request.url).toBe(toolsUrl);
    expect(request.method).toBe('POST');
    expect(request.headers.get('accept')).toBe('text/event-stream');
    expect(parseJsonBody(request)).toEqual({
      action: 'ask',
      corpusId: 'corpus-1',
      question: 'Hello?',
      stream: true,
    });
  });

  it.each(
    apiErrorCases([
      ['executeKbTool', (client) => client.executeKbTool(WS, { action: 'list_corpora' })],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
