import { describe, expect, it } from 'vitest';

import type { KbToolRequest, KbToolResponse } from '../../src/index.js';
import { BASE_URL, createHarness, jsonResponse, parseJsonBody, WS } from './harness.js';

const toolsUrl = `${BASE_URL}/api/workspaces/${WS}/tools/kb`;

describe('agent write tool contract', () => {
  it.each([
    [
      'append_document',
      {
        action: 'append_document',
        corpusId: 'corpus-1',
        path: 'notes/log.md',
        body: 'New entry',
      } satisfies KbToolRequest,
      { ok: true, action: 'append_document', nodeId: 'node-1' } satisfies KbToolResponse,
    ],
    [
      'create_document',
      {
        action: 'create_document',
        corpusId: 'corpus-1',
        path: 'notes',
        name: 'a.md',
        body: '# A',
      } satisfies KbToolRequest,
      {
        ok: true,
        action: 'create_document',
        nodeId: 'node-2',
        path: 'notes/a.md',
      } satisfies KbToolResponse,
    ],
    [
      'update_document',
      {
        action: 'update_document',
        corpusId: 'corpus-1',
        nodeId: 'node-1',
        body: '# Updated',
      } satisfies KbToolRequest,
      { ok: true, action: 'update_document', nodeId: 'node-1' } satisfies KbToolResponse,
    ],
    [
      'delete_document',
      {
        action: 'delete_document',
        corpusId: 'corpus-1',
        nodeId: 'node-1',
      } satisfies KbToolRequest,
      { ok: true, action: 'delete_document', deleted: 1 } satisfies KbToolResponse,
    ],
  ])('%s POSTs the full request body to /tools/kb', async (_name, request, response) => {
    const harness = createHarness(() => jsonResponse(response));
    await expect(harness.client.executeKbTool(WS, request)).resolves.toEqual(response);
    const recorded = harness.lastRequest();
    expect(recorded.url).toBe(toolsUrl);
    expect(recorded.method).toBe('POST');
    expect(parseJsonBody(recorded)).toEqual(request);
  });
});
