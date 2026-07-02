import { describe, expect, it } from 'vitest';

import {
  BASE_URL,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const entry = {
  id: 'audit-1',
  workspaceId: WS,
  action: 'kb.write.create_document',
  actor: { kind: 'api_key', tokenId: 'token-1' },
  target: { corpusId: 'corpus-1', path: 'notes/a.md' },
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('audit contract', () => {
  it('listAuditLog issues GET /api/workspaces/{workspaceId}/audit without query by default', async () => {
    const harness = createHarness(() => jsonResponse([entry]));
    await expect(harness.client.listAuditLog(WS)).resolves.toEqual([entry]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/audit`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('listAuditLog forwards limit and action query params', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.listAuditLog(WS, { limit: 10, action: 'kb.write.create_document' });
    expect(harness.lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/${WS}/audit?limit=10&action=kb.write.create_document`,
    );
  });

  it('listAuditLog surfaces JSON API errors as EvuKbApiError', async () => {
    await expectStandardApiError((client) => client.listAuditLog(WS));
  });
});
