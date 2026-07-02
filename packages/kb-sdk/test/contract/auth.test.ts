import { describe, expect, it } from 'vitest';

import type { CreateAuthCredentialRequest } from '../../src/index.js';
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

const tokenRecord = {
  id: 'token-1',
  workspaceId: WS,
  name: 'agent',
  scopes: ['kb:read'],
  expiresAt: null,
  createdAt: '2026-01-01',
};

describe('auth credentials contract', () => {
  it('listMcpTokens issues GET /api/workspaces/{workspaceId}/mcp-tokens', async () => {
    const harness = createHarness(() => jsonResponse([tokenRecord]));
    await expect(harness.client.listMcpTokens(WS)).resolves.toEqual([tokenRecord]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/mcp-tokens`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('createMcpToken issues POST with credential body', async () => {
    const harness = createHarness(() => jsonResponse({ ...tokenRecord, token: 't' }, 201));
    const body: CreateAuthCredentialRequest = { name: 'agent', scopes: ['kb:read', 'kb:write'] };
    await harness.client.createMcpToken(WS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/mcp-tokens`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('revokeMcpToken issues DELETE /mcp-tokens/{tokenId}', async () => {
    const harness = createHarness(() => new Response(null, { status: 204 }));
    await expect(harness.client.revokeMcpToken(WS, 'token-1')).resolves.toBeUndefined();
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/mcp-tokens/token-1`);
    expect(request.method).toBe('DELETE');
  });

  it('rotateMcpToken issues POST /mcp-tokens/{tokenId}/rotate without body', async () => {
    const harness = createHarness(() => jsonResponse({ ...tokenRecord, token: 't2' }));
    await harness.client.rotateMcpToken(WS, 'token-1');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/mcp-tokens/token-1/rotate`);
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('listApiKeys issues GET /api/workspaces/{workspaceId}/api-keys', async () => {
    const harness = createHarness(() => jsonResponse([tokenRecord]));
    await harness.client.listApiKeys(WS);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/api-keys`);
    expect(request.method).toBe('GET');
  });

  it('createApiKey issues POST with credential body', async () => {
    const harness = createHarness(() => jsonResponse({ ...tokenRecord, key: 'k' }, 201));
    const body: CreateAuthCredentialRequest = { name: 'ci', expiresAt: '2027-01-01T00:00:00Z' };
    await harness.client.createApiKey(WS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/api-keys`);
    expect(request.method).toBe('POST');
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('revokeApiKey issues DELETE /api-keys/{keyId}', async () => {
    const harness = createHarness(() => new Response(null, { status: 204 }));
    await harness.client.revokeApiKey(WS, 'key one');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/api-keys/key%20one`);
    expect(request.method).toBe('DELETE');
  });

  it('rotateApiKey issues POST /api-keys/{keyId}/rotate', async () => {
    const harness = createHarness(() => jsonResponse({ ...tokenRecord, key: 'k2' }));
    await harness.client.rotateApiKey(WS, 'key-1');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/api-keys/key-1/rotate`);
    expect(request.method).toBe('POST');
  });

  it('omits the authorization header when no apiKey is configured', async () => {
    const harness = createHarness(() => jsonResponse([]), { apiKey: false });
    await harness.client.listApiKeys(WS);
    expect(harness.lastRequest().headers.get('authorization')).toBeNull();
  });

  it.each(
    apiErrorCases([
      ['listMcpTokens', (client) => client.listMcpTokens(WS)],
      ['createMcpToken', (client) => client.createMcpToken(WS, { name: 'n' })],
      ['revokeMcpToken', (client) => client.revokeMcpToken(WS, 't')],
      ['rotateMcpToken', (client) => client.rotateMcpToken(WS, 't')],
      ['listApiKeys', (client) => client.listApiKeys(WS)],
      ['createApiKey', (client) => client.createApiKey(WS, { name: 'n' })],
      ['revokeApiKey', (client) => client.revokeApiKey(WS, 'k')],
      ['rotateApiKey', (client) => client.rotateApiKey(WS, 'k')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
