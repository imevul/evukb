import { describe, expect, it } from 'vitest';

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

const secret = { id: 'secret-1', workspaceId: WS, name: 'git-cred', createdAt: '2026-01-01' };

describe('secrets contract', () => {
  it('listSecrets issues GET /api/workspaces/{workspaceId}/secrets', async () => {
    const harness = createHarness(() => jsonResponse([secret]));
    await expect(harness.client.listSecrets(WS)).resolves.toEqual([secret]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/secrets`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('createSecret issues POST with name and value body', async () => {
    const harness = createHarness(() => jsonResponse({ ...secret, value: 'v' }, 201));
    await harness.client.createSecret(WS, { name: 'git-cred', value: 'hunter2' });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/secrets`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual({ name: 'git-cred', value: 'hunter2' });
  });

  it('deleteSecret issues DELETE /secrets/{secretId} with encoded id', async () => {
    const harness = createHarness(() => new Response(null, { status: 204 }));
    await expect(harness.client.deleteSecret(WS, 'secret one')).resolves.toBeUndefined();
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/secrets/secret%20one`);
    expect(request.method).toBe('DELETE');
  });

  it('rotateSecret issues PATCH /secrets/{secretId} with value body', async () => {
    const harness = createHarness(() => jsonResponse(secret));
    await harness.client.rotateSecret(WS, 'secret-1', { value: 'rotated' });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/secrets/secret-1`);
    expect(request.method).toBe('PATCH');
    expect(parseJsonBody(request)).toEqual({ value: 'rotated' });
  });

  it.each(
    apiErrorCases([
      ['listSecrets', (client) => client.listSecrets(WS)],
      ['createSecret', (client) => client.createSecret(WS, { name: 'n', value: 'v' })],
      ['deleteSecret', (client) => client.deleteSecret(WS, 's')],
      ['rotateSecret', (client) => client.rotateSecret(WS, 's', { value: 'v' })],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
