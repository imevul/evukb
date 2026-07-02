import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  callMcpTool,
  createStubChatProvider,
  createTestApiKey,
  databaseUrl,
  describeIfDb,
  parseMcpToolResult,
  requireDatabaseUrl,
  type TestServer,
  waitForBackgroundJobs,
  waitForNodeIndexed,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server workspace isolation golden', () => {
  async function seedIndexedCorpus(
    server: TestServer,
    workspaceId: string,
    content = '# Isolation Fixture\n\nEvuKB isolation alpha keyword.\n',
  ) {
    const createCorpus = await server.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/knowledge-corpora`,
      payload: { name: 'Isolation Docs' },
    });
    expect(createCorpus.statusCode).toBe(201);
    const corpus = createCorpus.json();

    const upload = await server.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/knowledge-corpora/${corpus.id}/files`,
      payload: {
        path: '',
        name: 'isolation-fixture.md',
        content,
      },
    });
    expect(upload.statusCode).toBe(201);
    const file = upload.json();

    await waitForNodeIndexedViaJobs(server, workspaceId, corpus.id, file.id);

    const reindex = await server.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/knowledge-corpora/${corpus.id}/reindex`,
      payload: { nodeIds: [file.id] },
    });
    expect(reindex.statusCode).toBe(200);
    await waitForBackgroundJobs(server);
    await waitForNodeIndexed(server, workspaceId, corpus.id, file.id);

    return { corpus, file };
  }

  it('denies cross-workspace access across HTTP, search, ask, MCP, and tools/kb surfaces', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-isolation-'));
    const previousRequireKey = process.env.EVUKB_REQUIRE_API_KEY;
    const previousEnableAsk = process.env.EVUKB_MCP_ENABLE_ASK;
    process.env.EVUKB_MCP_ENABLE_ASK = 'true';
    try {
      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspaceA = await workspaces.create({
        slug: `iso-a-${randomUUID()}`,
        name: 'Isolation Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `iso-b-${randomUUID()}`,
        name: 'Isolation Workspace B',
      });
      await handle.close();

      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createStubChatProvider(),
      });

      const { corpus, file } = await seedIndexedCorpus(server, workspaceA.id);

      const wrongWorkspaceFileRead = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspaceB.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
      });
      expect(wrongWorkspaceFileRead.statusCode).toBe(404);

      const unknownWorkspaceFileRead = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
      });
      expect(unknownWorkspaceFileRead.statusCode).toBe(404);

      const wrongWorkspaceCorpusGet = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspaceB.id}/knowledge-corpora/${corpus.id}`,
      });
      expect(wrongWorkspaceCorpusGet.statusCode).toBe(404);

      const wrongWorkspaceSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceB.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'alpha keyword', limit: 5 },
      });
      expect(wrongWorkspaceSearch.statusCode).toBe(404);

      const wrongWorkspaceAsk = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceB.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'What is the alpha keyword?' },
      });
      expect(wrongWorkspaceAsk.statusCode).toBe(404);

      const indexedSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceA.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'alpha keyword', limit: 5 },
      });
      expect(indexedSearch.statusCode).toBe(200);
      expect(indexedSearch.json().length).toBeGreaterThan(0);

      const wrongWorkspaceLinkGraph = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspaceB.id}/knowledge-corpora/${corpus.id}/link-graph`,
      });
      expect(wrongWorkspaceLinkGraph.statusCode).toBe(404);

      const wrongWorkspaceSearchRoute = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceB.id}/search`,
        payload: { query: 'alpha keyword', corpusIds: [corpus.id], limit: 5 },
      });
      expect(wrongWorkspaceSearchRoute.statusCode).toBe(404);

      const wrongWorkspaceAskRoute = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceB.id}/ask`,
        payload: {
          question: 'What is the alpha keyword?',
          corpusIds: [corpus.id],
        },
      });
      expect(wrongWorkspaceAskRoute.statusCode).toBe(404);

      const unknownWorkspaceSearchRoute = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${randomUUID()}/search`,
        payload: { query: 'alpha keyword', corpusIds: [corpus.id], limit: 5 },
      });
      expect(unknownWorkspaceSearchRoute.statusCode).toBe(404);

      const mcpSearchWrongWorkspace = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.search',
          { corpusId: corpus.id, query: 'alpha keyword' },
          { 'x-evukb-workspace-id': workspaceB.id },
        ),
      );
      expect(mcpSearchWrongWorkspace?.isError).toBe(true);
      expect(mcpSearchWrongWorkspace?.structuredContent).toMatchObject({
        code: 'corpus_not_found',
      });

      const mcpAskWrongWorkspace = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.ask',
          { corpusId: corpus.id, question: 'What is the alpha keyword?' },
          { 'x-evukb-workspace-id': workspaceB.id },
        ),
      );
      expect(mcpAskWrongWorkspace?.isError).toBe(true);
      expect(mcpAskWrongWorkspace?.structuredContent).toMatchObject({
        code: 'corpus_not_found',
      });

      const mcpGetDocumentWrongWorkspace = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.get_document',
          { corpusId: corpus.id, nodeId: file.id },
          { 'x-evukb-workspace-id': workspaceB.id },
        ),
      );
      expect(mcpGetDocumentWrongWorkspace?.isError).toBe(true);
      expect(mcpGetDocumentWrongWorkspace?.structuredContent).toMatchObject({
        code: 'node_not_found',
      });

      const mcpCorporaListWrongWorkspace = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.corpora.list',
          {},
          { 'x-evukb-workspace-id': randomUUID() },
        ),
      );
      expect(mcpCorporaListWrongWorkspace?.isError).toBe(true);
      expect(mcpCorporaListWrongWorkspace?.structuredContent).toMatchObject({
        code: 'workspace_not_found',
      });

      process.env.EVUKB_REQUIRE_API_KEY = 'true';
      const readApiKey = await createTestApiKey(workspaceA.id, 'Isolation read key', ['kb:read']);

      const toolsKbWrongWorkspace = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceB.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey}` },
        payload: {
          action: 'search',
          corpusId: corpus.id,
          query: 'alpha keyword',
          limit: 5,
        },
      });
      expect(toolsKbWrongWorkspace.statusCode).toBe(403);

      const toolsKbSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceA.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey}` },
        payload: {
          action: 'search',
          corpusId: corpus.id,
          query: 'alpha keyword',
          limit: 5,
        },
      });
      expect(toolsKbSearch.statusCode).toBe(200);
      expect(toolsKbSearch.json()).toMatchObject({ ok: true, action: 'search' });

      await server.close();
    } finally {
      if (previousRequireKey === undefined) {
        delete process.env.EVUKB_REQUIRE_API_KEY;
      } else {
        process.env.EVUKB_REQUIRE_API_KEY = previousRequireKey;
      }
      if (previousEnableAsk === undefined) {
        delete process.env.EVUKB_MCP_ENABLE_ASK;
      } else {
        process.env.EVUKB_MCP_ENABLE_ASK = previousEnableAsk;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
