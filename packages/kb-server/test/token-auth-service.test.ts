import { describe, expect, it, vi } from 'vitest';

import { TokenAuthService } from '../src/services/token-auth-service.js';

function buildService() {
  const create = vi.fn(async (input: Record<string, unknown>) => ({
    id: 'record-1',
    workspaceId: input.workspaceId,
    name: input.name,
    scopes: input.scopes,
    writePathPrefixes: input.writePathPrefixes ?? null,
    expiresAt: input.expiresAt ?? null,
    createdAt: new Date().toISOString(),
  }));
  const repo = { create } as never;
  const workspaces = {
    getById: vi.fn().mockResolvedValue({ id: 'ws-1', settings: {} }),
  };
  return { create, service: new TokenAuthService(repo, repo, workspaces as never) };
}

describe('TokenAuthService scope defaults', () => {
  it('defaults omitted API key scopes to kb:read', async () => {
    const { create, service } = buildService();
    const created = await service.createApiKey({ name: 'ci', workspaceId: 'ws-1' });

    expect(created.scopes).toEqual(['kb:read']);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['kb:read'] }));
  });

  it('defaults explicitly empty scopes to kb:read', async () => {
    const { service } = buildService();
    const apiKey = await service.createApiKey({ name: 'ci', scopes: [], workspaceId: 'ws-1' });
    const mcpToken = await service.createMcpToken({
      name: 'agent',
      scopes: [],
      workspaceId: 'ws-1',
    });

    expect(apiKey.scopes).toEqual(['kb:read']);
    expect(mcpToken.scopes).toEqual(['kb:read']);
  });

  it('accepts kb:admin scope', async () => {
    const { service } = buildService();
    const apiKey = await service.createApiKey({
      name: 'admin',
      scopes: ['kb:admin'],
      workspaceId: 'ws-1',
    });
    expect(apiKey.scopes).toEqual(['kb:admin']);
  });

  it('rejects unknown scopes', async () => {
    const { service } = buildService();
    await expect(
      service.createApiKey({ name: 'ci', scopes: ['kb:superuser' as never], workspaceId: 'ws-1' }),
    ).rejects.toThrow(/Invalid scope/);
  });

  it('rejects write path prefixes outside workspace allowlist', async () => {
    const { service } = buildService();
    await expect(
      service.createApiKey({
        name: 'narrow',
        scopes: ['kb:write'],
        workspaceId: 'ws-1',
        writePathPrefixes: ['drafts'],
      }),
    ).rejects.toThrow(/workspace write path prefixes/);
  });
});
