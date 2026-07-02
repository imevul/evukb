import type { Workspace } from '@evu/kb-core';
import type { ServerContext } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/errors.js';
import type { EvuKbRuntime } from '../src/index.js';
import {
  assertMcpReadScope,
  assertMcpWriteScope,
  resolveMcpHttpAuth,
  resolveWorkspace,
} from '../src/mcp/context.js';
import { runWithMcpAuth } from '../src/mcp/request-context.js';
import {
  toolError,
  toolSuccess,
  withMcpToolContext,
  withMcpWriteToolContext,
} from '../src/mcp/tool-runtime.js';
import { TokenAuthService } from '../src/services/token-auth-service.js';

function createContext(headers: Record<string, string> = {}): ServerContext {
  return {
    http: {
      req: new Request('http://localhost/mcp', { headers }),
    },
  } as ServerContext;
}

function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    slug: 'test-workspace',
    name: 'Test Workspace',
    settings: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createRuntime(overrides: Partial<EvuKbRuntime> = {}): EvuKbRuntime {
  return {
    workspaces: {
      list: vi.fn(),
      getById: vi.fn(),
      getBySlug: vi.fn(),
    },
    corpora: {
      listByWorkspace: vi.fn(),
      getById: vi.fn(),
    },
    nodes: {},
    chunks: {},
    links: {},
    fileManager: {},
    indexService: {},
    searchService: {},
    askService: {},
    tokenAuth: new TokenAuthService(
      {
        create: vi.fn(),
        listByWorkspace: vi.fn(),
        revoke: vi.fn(),
        findByHash: vi.fn(),
      } as never,
      {
        create: vi.fn(),
        listByWorkspace: vi.fn(),
        revoke: vi.fn(),
        findByHash: vi.fn(),
      } as never,
    ),
    db: {},
    blobStore: {},
    linkGraphService: {},
    corpusStatsService: {},
    agentWriteService: {
      execute: vi.fn(),
    },
    ...overrides,
  } as unknown as EvuKbRuntime;
}

describe('mcp context', () => {
  const originalToken = process.env.EVUKB_MCP_DEV_TOKEN;
  const originalRequireToken = process.env.EVUKB_MCP_REQUIRE_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.EVUKB_MCP_DEV_TOKEN;
    } else {
      process.env.EVUKB_MCP_DEV_TOKEN = originalToken;
    }
    if (originalRequireToken === undefined) {
      delete process.env.EVUKB_MCP_REQUIRE_TOKEN;
    } else {
      process.env.EVUKB_MCP_REQUIRE_TOKEN = originalRequireToken;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('requires bearer token when EVUKB_MCP_DEV_TOKEN is set', async () => {
    process.env.EVUKB_MCP_DEV_TOKEN = 'secret-token';
    const tokenAuth = createRuntime().tokenAuth;
    await expect(resolveMcpHttpAuth(tokenAuth, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      resolveMcpHttpAuth(tokenAuth, { authorization: 'Bearer secret-token' }),
    ).resolves.toEqual({ kind: 'dev' });
  });

  it('resolves workspace from header, input, or local-dev fallback', async () => {
    const workspace = createWorkspace();
    const workspaces = {
      getById: vi.fn().mockResolvedValue(null),
      getBySlug: vi.fn().mockResolvedValue(workspace),
    };

    await expect(
      resolveWorkspace(
        workspaces as never,
        createContext({ 'x-evukb-workspace-id': 'test-workspace' }),
      ),
    ).resolves.toEqual(workspace);
    await expect(
      resolveWorkspace(workspaces as never, createContext(), 'test-workspace'),
    ).resolves.toEqual(workspace);
    await expect(resolveWorkspace(workspaces as never, createContext())).resolves.toEqual(
      workspace,
    );
  });

  it('uses token workspace as authoritative and rejects mismatched headers', async () => {
    const tokenWorkspace = createWorkspace({ id: 'ws-token', slug: 'token-workspace' });
    const otherWorkspace = createWorkspace({ id: 'ws-other', slug: 'other-workspace' });
    const workspaces = {
      getById: vi.fn(async (id: string) => {
        if (id === tokenWorkspace.id) {
          return tokenWorkspace;
        }
        if (id === otherWorkspace.id) {
          return otherWorkspace;
        }
        return null;
      }),
      getBySlug: vi.fn(async (slug: string) => {
        if (slug === otherWorkspace.slug) {
          return otherWorkspace;
        }
        return null;
      }),
    };

    await expect(
      resolveWorkspace(
        workspaces as never,
        createContext({ 'x-evukb-workspace-id': otherWorkspace.id }),
        undefined,
        { kind: 'db', workspaceId: tokenWorkspace.id, scopes: ['kb:read'], tokenId: 'token-1' },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });

    await expect(
      resolveWorkspace(workspaces as never, createContext(), undefined, {
        kind: 'db',
        workspaceId: tokenWorkspace.id,
        scopes: ['kb:read'],
        tokenId: 'token-1',
      }),
    ).resolves.toEqual(tokenWorkspace);
  });

  it('returns workspace_not_found when workspace cannot be resolved', async () => {
    const workspaces = {
      getById: vi.fn().mockResolvedValue(null),
      getBySlug: vi.fn().mockResolvedValue(null),
    };

    await expect(
      resolveWorkspace(workspaces as never, createContext(), 'missing-workspace'),
    ).rejects.toMatchObject({ code: 'workspace_not_found' });
  });

  it('rejects MCP tokens missing kb:read scope', () => {
    expect(() =>
      assertMcpReadScope({ kind: 'db', workspaceId: 'ws-1', scopes: ['kb:write'], tokenId: 't1' }),
    ).toThrow(ApiError);
    expect(() =>
      assertMcpReadScope({ kind: 'db', workspaceId: 'ws-1', scopes: ['kb:read'], tokenId: 't1' }),
    ).not.toThrow();
    expect(() => assertMcpReadScope({ kind: 'open' })).not.toThrow();
  });

  it('rejects MCP tokens missing kb:write scope for write tools', () => {
    expect(() =>
      assertMcpWriteScope({ kind: 'db', workspaceId: 'ws-1', scopes: ['kb:read'], tokenId: 't1' }),
    ).toThrow(ApiError);
    expect(() =>
      assertMcpWriteScope({ kind: 'db', workspaceId: 'ws-1', scopes: ['kb:write'], tokenId: 't1' }),
    ).not.toThrow();
    expect(() => assertMcpWriteScope({ kind: 'open' })).not.toThrow();
  });
});

describe('mcp tool runtime', () => {
  it('wraps successful tool output', () => {
    const result = toolSuccess({ ok: true });
    expect(result.structuredContent).toEqual({ ok: true });
    expect(result.isError).toBeUndefined();
  });

  it('maps ApiError to structured tool errors', () => {
    const result = toolError(ApiError.corpusNotFound('corpus-1'));
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'corpus_not_found',
    });
  });

  it('enforces workspace isolation through service errors', async () => {
    const workspace = createWorkspace();
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        getBySlug: vi.fn().mockResolvedValue(workspace),
      },
      searchService: {
        search: vi.fn().mockRejectedValue(ApiError.corpusNotFound('corpus-other')),
      },
    } as unknown as Partial<EvuKbRuntime>);

    const result = await runWithMcpAuth({ kind: 'open' }, () =>
      withMcpToolContext(
        runtime,
        createContext({ 'x-evukb-workspace-id': 'test-workspace' }),
        undefined,
        async (workspace) =>
          runtime.searchService.search(workspace.id, 'corpus-other', { query: 'alpha' }),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'corpus_not_found' });
  });

  it('maps node not found to corpus isolation errors for get_document', async () => {
    const workspace = createWorkspace({
      id: '00000000-0000-4000-8000-000000000001',
    });
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(workspace),
        getBySlug: vi.fn(),
      },
      fileManager: {
        readContent: vi.fn().mockRejectedValue(ApiError.nodeNotFound('node-other')),
      },
    } as unknown as Partial<EvuKbRuntime>);

    const result = await runWithMcpAuth({ kind: 'open' }, () =>
      withMcpToolContext(
        runtime,
        createContext({ 'x-evukb-workspace-id': workspace.id }),
        undefined,
        async (resolvedWorkspace) =>
          runtime.fileManager.readContent(resolvedWorkspace.id, 'corpus-other', 'node-other'),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'node_not_found' });
  });

  it('rejects corpora list when workspace header does not resolve', async () => {
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        getBySlug: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Partial<EvuKbRuntime>);

    const result = await runWithMcpAuth({ kind: 'open' }, () =>
      withMcpToolContext(
        runtime,
        createContext({ 'x-evukb-workspace-id': 'missing-workspace' }),
        undefined,
        async () => ({ items: [] }),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'workspace_not_found' });
  });

  it('returns forbidden when MCP token lacks kb:read scope', async () => {
    const workspace = createWorkspace();
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(workspace),
        getBySlug: vi.fn(),
      },
    });

    const result = await runWithMcpAuth(
      { kind: 'db', workspaceId: workspace.id, scopes: ['kb:write'], tokenId: 'token-1' },
      () =>
        withMcpToolContext(runtime, createContext(), undefined, async () => {
          return { ok: true };
        }),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'forbidden' });
  });

  it('allows kb:write tokens through write tool context', async () => {
    const workspace = createWorkspace();
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(workspace),
        getBySlug: vi.fn(),
      },
      agentWriteService: {
        execute: vi.fn().mockResolvedValue({ ok: true, action: 'create_document', nodeId: 'n1' }),
      },
    });

    const result = await runWithMcpAuth(
      { kind: 'db', workspaceId: workspace.id, scopes: ['kb:write'], tokenId: 'token-1' },
      () =>
        withMcpWriteToolContext(runtime, createContext(), undefined, async (resolvedWorkspace) =>
          runtime.agentWriteService.execute(
            resolvedWorkspace.id,
            { kind: 'mcp_token', tokenId: 'token-1' },
            {
              action: 'create_document',
              corpusId: 'corpus-1',
              path: 'agent-notes',
              name: 'note.md',
              body: '# Note',
            },
          ),
        ),
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ ok: true, nodeId: 'n1' });
  });

  it('returns forbidden when MCP token lacks kb:write scope for write tools', async () => {
    const workspace = createWorkspace();
    const runtime = createRuntime({
      workspaces: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(workspace),
        getBySlug: vi.fn(),
      },
    });

    const result = await runWithMcpAuth(
      { kind: 'db', workspaceId: workspace.id, scopes: ['kb:read'], tokenId: 'token-1' },
      () =>
        withMcpWriteToolContext(runtime, createContext(), undefined, async () => {
          return { ok: true };
        }),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'forbidden' });
  });
});
