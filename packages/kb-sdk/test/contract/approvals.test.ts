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

const approval = {
  id: 'approval-1',
  workspaceId: WS,
  corpusId: 'corpus-1',
  status: 'pending',
  action: 'create_document',
  actor: { kind: 'mcp_token', tokenId: 'token-1' },
  preview: { corpusId: 'corpus-1', action: 'create_document', path: 'notes/a.md' },
  decidedBy: null,
  decidedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('approvals contract', () => {
  it('listMutationApprovals issues GET /api/workspaces/{workspaceId}/approvals', async () => {
    const harness = createHarness(() => jsonResponse([approval]));
    await expect(harness.client.listMutationApprovals(WS)).resolves.toEqual([approval]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/approvals`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('approveMutation issues POST /approvals/{approvalId}/approve without body', async () => {
    const harness = createHarness(() =>
      jsonResponse({ ok: true, action: 'create_document', nodeId: 'node-1' }),
    );
    await expect(harness.client.approveMutation(WS, 'approval one')).resolves.toEqual({
      ok: true,
      action: 'create_document',
      nodeId: 'node-1',
    });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/approvals/approval%20one/approve`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('rejectMutation issues POST /approvals/{approvalId}/reject without body', async () => {
    const harness = createHarness(() => jsonResponse({ ...approval, status: 'rejected' }));
    await harness.client.rejectMutation(WS, 'approval-1');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/approvals/approval-1/reject`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it.each(
    apiErrorCases([
      ['listMutationApprovals', (client) => client.listMutationApprovals(WS)],
      ['approveMutation', (client) => client.approveMutation(WS, 'a')],
      ['rejectMutation', (client) => client.rejectMutation(WS, 'a')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
