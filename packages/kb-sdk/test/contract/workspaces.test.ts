import { describe, expect, it } from 'vitest';

import type { CreateWorkspaceRequest } from '../../src/index.js';
import {
  apiErrorCases,
  BASE_URL,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  parseJsonBody,
} from './harness.js';

const workspaceSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'ops',
  name: 'Ops',
  settings: {},
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('workspaces contract', () => {
  it('listWorkspaces issues GET /api/workspaces', async () => {
    const harness = createHarness(() => jsonResponse([workspaceSummary]));
    await expect(harness.client.listWorkspaces()).resolves.toEqual([workspaceSummary]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('createWorkspace issues POST /api/workspaces with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(workspaceSummary));
    const body: CreateWorkspaceRequest = { slug: 'ops', name: 'Ops' };
    await harness.client.createWorkspace(body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('deleteWorkspace issues DELETE /api/workspaces/{workspaceId}', async () => {
    const harness = createHarness(() =>
      jsonResponse({ deleted: true, id: workspaceSummary.id, slug: workspaceSummary.slug }),
    );
    await harness.client.deleteWorkspace('ops');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ops`);
    expect(request.method).toBe('DELETE');
  });

  it.each(
    apiErrorCases([
      ['listWorkspaces', (client) => client.listWorkspaces()],
      ['createWorkspace', (client) => client.createWorkspace({ slug: 'ops', name: 'Ops' })],
      ['deleteWorkspace', (client) => client.deleteWorkspace('ops')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
