import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  callMcpTool,
  createStubChatProvider,
  databaseUrl,
  describeIfDb,
  mcpAccept,
  parseMcpToolResult,
  requireDatabaseUrl,
  waitForBackgroundJobs,
  waitForNodeIndexed,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server MCP tools', () => {
  it('searches and asks over indexed corpus content via POST /mcp', async () => {
    const previousEnableAsk = process.env.EVUKB_MCP_ENABLE_ASK;
    process.env.EVUKB_MCP_ENABLE_ASK = 'true';
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-mcp-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createStubChatProvider(),
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'MCP Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'mcp-target.md',
          content: '# MCP Target\n\nEvuKB MCP alpha fixture keyword.\n',
        },
      });
      const file = upload.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const reindex = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex`,
        payload: { nodeIds: [file.id] },
      });
      expect(reindex.statusCode).toBe(200);
      expect(reindex.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const searchResult = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.search',
          { corpusId: corpus.id, query: 'alpha fixture' },
          { 'x-evukb-workspace-id': workspace.id },
        ),
      );
      expect(searchResult?.isError).not.toBe(true);
      const searchHits = searchResult?.structuredContent as {
        items?: Array<{ bodyPreview?: string }>;
      };
      expect(Array.isArray(searchHits.items)).toBe(true);
      expect(searchHits.items?.[0]?.bodyPreview).toContain('alpha');

      const askResult = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.ask',
          { corpusId: corpus.id, question: 'What is the alpha fixture?' },
          { 'x-evukb-workspace-id': workspace.id },
        ),
      );
      expect(askResult?.isError).not.toBe(true);
      const askPayload = askResult?.structuredContent as {
        answer?: string;
        citations?: unknown[];
      };
      expect(askPayload.answer).toContain('alpha fixture');
      expect(askPayload.citations?.length).toBeGreaterThan(0);

      const wrongWorkspace = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.search',
          { corpusId: corpus.id, query: 'alpha' },
          { 'x-evukb-workspace-id': randomUUID() },
        ),
      );
      expect(wrongWorkspace?.isError).toBe(true);
      expect(wrongWorkspace?.structuredContent).toMatchObject({ code: 'workspace_not_found' });

      await server.close();
    } finally {
      if (previousEnableAsk === undefined) {
        delete process.env.EVUKB_MCP_ENABLE_ASK;
      } else {
        process.env.EVUKB_MCP_ENABLE_ASK = previousEnableAsk;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server MCP token auth', () => {
  it('authenticates MCP tools with workspace-bound bearer tokens', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-mcp-auth-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: null,
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'MCP Auth Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const createToken = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/mcp-tokens`,
        payload: { name: 'Agent token', scopes: ['kb:read'] },
      });
      expect(createToken.statusCode).toBe(201);
      const token = createToken.json() as { token: string; id: string };

      const listTools = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          accept: mcpAccept,
          'content-type': 'application/json',
          authorization: `Bearer ${token.token}`,
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
      expect(listTools.statusCode).toBe(200);
      const toolNames = (
        JSON.parse(listTools.body) as {
          result?: { tools?: Array<{ name?: string }> };
        }
      ).result?.tools?.map((tool) => tool.name);
      expect(toolNames).not.toContain('evu.kb.ask');

      const wrongBearer = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          accept: mcpAccept,
          'content-type': 'application/json',
          authorization: 'Bearer evukb_mcp_invalid',
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
      expect(wrongBearer.statusCode).toBe(403);

      const mismatch = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.search',
          { corpusId: corpus.id, query: 'alpha' },
          {
            authorization: `Bearer ${token.token}`,
            'x-evukb-workspace-id': randomUUID(),
          },
        ),
      );
      expect(mismatch?.isError).toBe(true);
      expect(mismatch?.structuredContent).toMatchObject({ code: 'forbidden' });

      const revoke = await server.inject({
        method: 'DELETE',
        url: `/api/workspaces/${workspace.id}/mcp-tokens/${token.id}`,
      });
      expect(revoke.statusCode).toBe(204);

      const afterRevoke = await server.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          accept: mcpAccept,
          'content-type': 'application/json',
          authorization: `Bearer ${token.token}`,
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
      expect(afterRevoke.statusCode).toBe(403);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
