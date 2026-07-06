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
  waitForNodeIndexed,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server agent write tools', () => {
  it('creates agent-notes via MCP and HTTP with kb:write auth and audit rows', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-write-'));
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
      const workspace = await workspaces.create({ slug, name: 'Write Tools Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/${workspace.id}/settings`,
        payload: {
          settings: {
            mutationApprovalPolicy: {
              append: 'never',
              create: 'never',
              update: 'never',
              delete: 'never',
            },
          },
        },
      });

      const createMcpToken = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/mcp-tokens`,
        payload: { name: 'Write token', scopes: ['kb:write'] },
      });
      expect(createMcpToken.statusCode).toBe(201);
      const mcpToken = createMcpToken.json() as { token: string };

      const createApiKey = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/api-keys`,
        payload: { name: 'Write key', scopes: ['kb:write'] },
      });
      expect(createApiKey.statusCode).toBe(201);
      const apiKey = createApiKey.json() as { key: string };

      const readOnlyToken = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/mcp-tokens`,
        payload: { name: 'Read token', scopes: ['kb:read'] },
      });
      const readToken = readOnlyToken.json() as { token: string };

      const mcpCreate = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.create_document',
          {
            corpusId: corpus.id,
            path: 'agent-notes',
            name: 'session.md',
            body: '# Session\n',
          },
          {
            authorization: `Bearer ${mcpToken.token}`,
            'x-evukb-workspace-id': workspace.id,
          },
        ),
      );
      expect(mcpCreate?.isError).not.toBe(true);
      const mcpPayload = mcpCreate?.structuredContent as { nodeId?: string; path?: string };
      expect(mcpPayload.path).toBe('agent-notes/session.md');
      expect(mcpPayload.nodeId).toBeTruthy();

      const read = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${mcpPayload.nodeId}/content`,
      });
      expect(read.statusCode).toBe(200);
      expect(read.body).toBe('# Session\n');

      const httpAppend = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: {
          authorization: `Bearer ${apiKey.key}`,
        },
        payload: {
          action: 'append_document',
          corpusId: corpus.id,
          path: 'agent-notes/session.md',
          body: '\nAppended line.\n',
        },
      });
      expect(httpAppend.statusCode).toBe(200);
      expect(httpAppend.json()).toMatchObject({
        ok: true,
        action: 'append_document',
        path: 'agent-notes/session.md',
      });

      const readAfterAppend = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${mcpPayload.nodeId}/content`,
      });
      expect(readAfterAppend.body).toBe('# Session\n\nAppended line.\n');

      const readOnlyWrite = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.create_document',
          {
            corpusId: corpus.id,
            path: 'agent-notes',
            name: 'blocked.md',
            body: 'nope',
          },
          {
            authorization: `Bearer ${readToken.token}`,
            'x-evukb-workspace-id': workspace.id,
          },
        ),
      );
      expect(readOnlyWrite?.isError).toBe(true);
      expect(readOnlyWrite?.structuredContent).toMatchObject({ code: 'forbidden' });

      const readOnlyHttp = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: {
          authorization: `Bearer ${readToken.token}`,
        },
        payload: {
          action: 'create_document',
          corpusId: corpus.id,
          path: 'agent-notes',
          name: 'blocked-http.md',
          body: 'nope',
        },
      });
      expect(readOnlyHttp.statusCode).toBe(403);

      const auditList = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/audit?limit=50`,
      });
      expect(auditList.statusCode).toBe(200);
      const auditEntries = auditList.json() as Array<{ action: string; workspaceId: string }>;
      expect(auditEntries.length).toBeGreaterThanOrEqual(2);
      expect(auditEntries.every((entry) => entry.workspaceId === workspace.id)).toBe(true);
      expect(auditEntries.some((entry) => entry.action === 'create_document')).toBe(true);
      expect(auditEntries.some((entry) => entry.action === 'append_document')).toBe(true);

      const filteredAudit = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/audit?action=append_document`,
      });
      expect(filteredAudit.statusCode).toBe(200);
      const filteredEntries = filteredAudit.json() as Array<{ action: string }>;
      expect(filteredEntries.length).toBeGreaterThanOrEqual(1);
      expect(filteredEntries.every((entry) => entry.action === 'append_document')).toBe(true);

      const otherHandle = createDb({ connectionString: requireDatabaseUrl() });
      const otherWorkspaces = new WorkspaceRepository(otherHandle);
      const otherWorkspace = await otherWorkspaces.create({
        slug: `it-other-${randomUUID()}`,
        name: 'Other Workspace',
      });
      await otherHandle.close();
      const otherAudit = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${otherWorkspace.id}/audit`,
      });
      expect(otherAudit.statusCode).toBe(200);
      expect(otherAudit.json()).toEqual([]);

      const auditHandle = createDb({ connectionString: requireDatabaseUrl() });
      const auditResult = await auditHandle.pool.query<{ action: string }>(
        'SELECT action FROM audit_log WHERE workspace_id = $1',
        [workspace.id],
      );
      await auditHandle.close();
      expect(auditResult.rows.length).toBeGreaterThanOrEqual(2);
      expect(auditResult.rows.some((row) => row.action === 'create_document')).toBe(true);
      expect(auditResult.rows.some((row) => row.action === 'append_document')).toBe(true);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server read tools', () => {
  it('executes list_corpora and search with kb:read scope', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-read-tools-'));
    const slug = `it-${randomUUID()}`;
    const previousRequireKey = process.env.EVUKB_REQUIRE_API_KEY;
    process.env.EVUKB_REQUIRE_API_KEY = 'true';
    let server: TestServer | undefined;
    try {
      const { createDb, migrateLatest, CorpusRepository, WorkspaceRepository } = await import(
        '@evu/kb-db'
      );
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Read Tools Workspace' });
      const corpus = await new CorpusRepository(handle).create({
        workspaceId: workspace.id,
        name: 'Docs',
      });
      await handle.close();

      server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: null,
      });

      const readApiKey = await createTestApiKey(workspace.id, 'Read key', ['kb:read']);

      const unauthenticated = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        payload: { action: 'list_corpora' },
      });
      expect(unauthenticated.statusCode).toBe(403);

      const listCorpora = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey}` },
        payload: { action: 'list_corpora' },
      });
      expect(listCorpora.statusCode).toBe(200);
      expect(listCorpora.json()).toMatchObject({
        ok: true,
        action: 'list_corpora',
        result: expect.arrayContaining([expect.objectContaining({ id: corpus.id, name: 'Docs' })]),
      });

      const search = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey}` },
        payload: {
          action: 'search',
          corpusId: corpus.id,
          query: 'hello',
          limit: 5,
        },
      });
      expect(search.statusCode).toBe(200);
      expect(search.json()).toMatchObject({ ok: true, action: 'search', result: [] });

      const writeBlocked = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey}` },
        payload: {
          action: 'create_document',
          corpusId: corpus.id,
          path: 'notes',
          name: 'blocked.md',
          body: 'nope',
        },
      });
      expect(writeBlocked.statusCode).toBe(403);
    } finally {
      await server?.close();
      if (previousRequireKey === undefined) {
        delete process.env.EVUKB_REQUIRE_API_KEY;
      } else {
        process.env.EVUKB_REQUIRE_API_KEY = previousRequireKey;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('executes get_document, ask, and tag-filtered search with indexed fixtures', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-read-tools-ext-'));
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
      const workspace = await workspaces.create({ slug, name: 'Read Tools Extended Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const taggedUpload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'alpha.md',
          content:
            '---\ntype: Playbook\ntitle: Alpha Fixture\ntags:\n  - ops\n---\n\nEvuKB alpha fixture details.\n',
        },
      });
      expect(taggedUpload.statusCode).toBe(201);
      const taggedFile = taggedUpload.json() as { id: string };

      const otherUpload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'beta.md',
          content:
            '---\ntype: Document\ntitle: Beta\ntags:\n  - general\n---\n\nUnrelated beta content.\n',
        },
      });
      expect(otherUpload.statusCode).toBe(201);

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, taggedFile.id);

      const readKey = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/api-keys`,
        payload: { name: 'Read key extended', scopes: ['kb:read'] },
      });
      const readApiKey = readKey.json() as { key: string };

      const getDocument = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey.key}` },
        payload: {
          action: 'get_document',
          corpusId: corpus.id,
          nodeId: taggedFile.id,
        },
      });
      expect(getDocument.statusCode).toBe(200);
      expect(getDocument.json()).toMatchObject({
        ok: true,
        action: 'get_document',
        result: expect.objectContaining({
          nodeId: taggedFile.id,
          body: expect.stringContaining('alpha fixture'),
        }),
      });

      const filteredSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey.key}` },
        payload: {
          action: 'search',
          corpusId: corpus.id,
          query: 'alpha fixture',
          filters: { tags: ['ops'] },
          limit: 10,
        },
      });
      expect(filteredSearch.statusCode).toBe(200);
      const filteredHits = (filteredSearch.json() as { result: Array<{ filePath: string }> })
        .result;
      expect(filteredHits.length).toBeGreaterThan(0);
      expect(filteredHits.every((hit) => hit.filePath.includes('alpha.md'))).toBe(true);

      const excludedSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey.key}` },
        payload: {
          action: 'search',
          corpusId: corpus.id,
          query: 'alpha fixture',
          filters: { tags: ['missing-tag'] },
          limit: 10,
        },
      });
      expect(excludedSearch.statusCode).toBe(200);
      expect((excludedSearch.json() as { result: unknown[] }).result).toEqual([]);

      const ask = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${readApiKey.key}` },
        payload: {
          action: 'ask',
          corpusId: corpus.id,
          question: 'What is the alpha fixture?',
          filters: { tags: ['ops'] },
        },
      });
      expect(ask.statusCode).toBe(200);
      expect(ask.json()).toMatchObject({
        ok: true,
        action: 'ask',
        result: expect.objectContaining({
          answer: expect.stringContaining('alpha fixture'),
          citations: expect.any(Array),
        }),
      });

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('streams ask over POST /tools/kb when stream is true', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-read-tools-stream-'));
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
      const workspace = await workspaces.create({ slug, name: 'Read Tools Stream Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const taggedUpload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'alpha.md',
          content:
            '---\ntype: Playbook\ntitle: Alpha Fixture\ntags:\n  - ops\n---\n\nEvuKB alpha fixture details.\n',
        },
      });
      const taggedFile = taggedUpload.json() as { id: string };
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, taggedFile.id);

      const readKey = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/api-keys`,
        payload: { name: 'Read key stream', scopes: ['kb:read'] },
      });
      const readApiKey = readKey.json() as { key: string };

      const streamAsk = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: {
          authorization: `Bearer ${readApiKey.key}`,
          accept: 'text/event-stream',
        },
        payload: {
          action: 'ask',
          corpusId: corpus.id,
          question: 'What is the alpha fixture?',
          stream: true,
        },
      });
      expect(streamAsk.statusCode).toBe(200);
      expect(streamAsk.headers['content-type']).toContain('text/event-stream');
      expect(streamAsk.body).toContain('"type":"metadata"');
      expect(streamAsk.body).toContain('alpha fixture');

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('roundtrips PATCH /ai/providers workspace overrides', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-ai-providers-'));
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
      const workspace = await workspaces.create({ slug, name: 'AI Providers Workspace' });
      await handle.close();

      const patch = await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/${workspace.id}/ai/providers`,
        payload: {
          chat: { model: 'gpt-4o-mini-test' },
          embedding: { model: 'text-embedding-test' },
        },
      });
      expect(patch.statusCode).toBe(200);
      const view = patch.json() as {
        chat: { model: string; source?: string };
        embedding: { model: string; source?: string };
      };
      expect(view.chat.model).toBe('gpt-4o-mini-test');
      expect(view.embedding.model).toBe('text-embedding-test');
      expect(view.chat.source).toBe('database');
      expect(view.embedding.source).toBe('database');

      const rejected = await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/${workspace.id}/ai/providers`,
        payload: {
          chat: { apiKey: 'secret' },
        },
      });
      expect(rejected.statusCode).toBe(400);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server mutation approval', () => {
  it('gates create writes, supports approve/reject, and records audit events', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-approval-'));
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
      const workspace = await workspaces.create({ slug, name: 'Approval Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/${workspace.id}/settings`,
        payload: {
          settings: {
            mutationApprovalPolicy: {
              append: 'never',
              create: 'always',
              update: 'always',
              delete: 'always',
            },
          },
        },
      });

      const createApiKey = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/api-keys`,
        payload: { name: 'Write key', scopes: ['kb:write'] },
      });
      const apiKey = createApiKey.json() as { key: string };

      const pendingCreate = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${apiKey.key}` },
        payload: {
          action: 'create_document',
          corpusId: corpus.id,
          path: 'agent-notes',
          name: 'pending.md',
          body: '# Pending',
        },
      });
      expect(pendingCreate.statusCode).toBe(200);
      const pendingBody = pendingCreate.json();
      expect(pendingBody).toMatchObject({
        ok: false,
        pendingApproval: true,
      });
      expect(pendingBody.approvalId).toBeTruthy();

      const listFilesBefore = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes`,
      });
      expect(
        listFilesBefore.json().some((node: { name: string }) => node.name === 'pending.md'),
      ).toBe(false);

      const approve = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/approvals/${pendingBody.approvalId}/approve`,
        headers: { authorization: `Bearer ${apiKey.key}` },
      });
      expect(approve.statusCode).toBe(200);
      expect(approve.json()).toMatchObject({ ok: true, action: 'create_document' });

      const listFilesAfter = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes`,
      });
      expect(
        listFilesAfter.json().some((node: { name: string }) => node.name === 'pending.md'),
      ).toBe(true);

      const pendingUpdate = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        headers: { authorization: `Bearer ${apiKey.key}` },
        payload: {
          action: 'update_document',
          corpusId: corpus.id,
          nodeId: approve.json().nodeId,
          body: '# Updated',
        },
      });
      const updateApprovalId = pendingUpdate.json().approvalId as string;

      const reject = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/approvals/${updateApprovalId}/reject`,
        headers: { authorization: `Bearer ${apiKey.key}` },
      });
      expect(reject.statusCode).toBe(200);
      expect(reject.json().status).toBe('rejected');

      const auditList = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/audit?limit=50`,
      });
      const actions = (auditList.json() as Array<{ action: string }>).map((entry) => entry.action);
      expect(actions).toContain('mutation.approval.requested');
      expect(actions).toContain('mutation.approval.applied');
      expect(actions).toContain('mutation.approval.rejected');

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server agent inventory MCP surfaces', () => {
  async function createFolderChain(
    server: TestServer,
    workspaceId: string,
    corpusId: string,
    segments: string[],
  ): Promise<string> {
    let parentPath = '';
    for (const name of segments) {
      const folder = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspaceId}/knowledge-corpora/${corpusId}/folders`,
        payload: { path: parentPath, name },
      });
      expect(folder.statusCode).toBe(201);
      parentPath = parentPath ? `${parentPath}/${name}` : name;
    }
    return parentPath;
  }

  it('lists inventory rows and metadata-only search for frontmatter server notes', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-agent-inv-'));
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
      const workspace = await workspaces.create({ slug, name: 'Agent Inventory Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Fixture corpus' },
      });
      const corpus = createCorpus.json();

      const serverFolderPath = await createFolderChain(server, workspace.id, corpus.id, [
        'Areas',
        'Servers',
      ]);

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: serverFolderPath,
          name: 'pelle1.md',
          content:
            '---\ntype: server\nvirtual: true\nhostname: pelle1\nos: Ubuntu 24.04.4 LTS\n---\n\nServer body.\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const listInventory = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        payload: {
          action: 'list_documents',
          corpusId: corpus.id,
          pathPrefix: 'Areas/Servers',
          filters: { frontmatter: { type: 'server' } },
          fields: ['hostname', 'os', 'virtual'],
        },
      });
      expect(listInventory.statusCode).toBe(200);
      const rows = listInventory.json().result as Array<{
        path?: string;
        frontmatter?: Record<string, unknown>;
      }>;
      expect(rows.some((row) => row.path?.endsWith('pelle1.md'))).toBe(true);
      const pelle1 = rows.find((row) => row.path?.endsWith('pelle1.md'));
      expect(pelle1?.frontmatter).toMatchObject({
        hostname: 'pelle1',
        os: 'Ubuntu 24.04.4 LTS',
        virtual: true,
      });

      const metadataSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        payload: {
          action: 'search',
          corpusId: corpus.id,
          pathPrefix: 'Areas/Servers',
          filters: { frontmatter: { type: 'server' } },
        },
      });
      expect(metadataSearch.statusCode).toBe(200);
      const hits = metadataSearch.json().result as Array<{
        filePath?: string;
        matchKind?: string;
      }>;
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.matchKind).toBe('metadata');
      expect(hits.some((hit) => hit.filePath?.endsWith('pelle1.md'))).toBe(true);

      const unscopedSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/tools/kb`,
        payload: {
          action: 'search',
          corpusId: corpus.id,
        },
      });
      expect(unscopedSearch.statusCode).toBe(400);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
