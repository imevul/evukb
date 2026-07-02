import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  callMcpTool,
  databaseUrl,
  describeIfDb,
  parseMcpToolResult,
  requireDatabaseUrl,
  waitForBackgroundJobs,
  waitForNodeIndexed,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server corpus diagnostics reindex', () => {
  it('reindexes needing-attention files and updates corpus stats', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-diagnostics-'));
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
      const workspace = await workspaces.create({ slug, name: 'Diagnostics Workspace' });
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
          name: 'notes.md',
          content: '# Notes\n\nDiagnostics fixture keyword.\n',
        },
      });
      const file = upload.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const statusHandle = createDb({ connectionString: requireDatabaseUrl() });
      await statusHandle.pool.query('UPDATE knowledge_nodes SET index_status = $1 WHERE id = $2', [
        'pending',
        file.id,
      ]);
      await statusHandle.close();

      const reindexNeeding = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex-needing`,
      });
      expect(reindexNeeding.statusCode).toBe(200);
      expect(reindexNeeding.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const statsAfter = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(statsAfter.statusCode).toBe(200);
      expect(statsAfter.json().indexStatusCounts.indexed).toBeGreaterThan(0);
      expect(statsAfter.json().indexStatusCounts.pending).toBe(0);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server OKF validation', () => {
  it('records OKF validation issues on index without blocking indexing', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-okf-'));
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
      const workspace = await workspaces.create({ slug, name: 'OKF Workspace' });
      await handle.close();

      const invalidSettings = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Bad', settings: { formatProfile: 'invalid' } },
      });
      expect(invalidSettings.statusCode).toBe(400);

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'OKF Docs', settings: { formatProfile: 'okf' } },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'concept.md',
          content: '# Concept\n\nMissing OKF type frontmatter.\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const nodesResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      const indexedNode = nodesResponse
        .json()
        .find((entry: { id: string }) => entry.id === file.id);
      expect(indexedNode?.indexStatus).toBe('indexed');
      expect(indexedNode?.metadata?.okfConformant).toBe(false);
      expect(indexedNode?.metadata?.validationIssues?.length).toBeGreaterThan(0);

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      expect(stats.json().okfIssueCount).toBeGreaterThan(0);
      expect(stats.json().warnings.some((warning: string) => warning.includes('OKF'))).toBe(true);

      const graph = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/link-graph`,
      });
      expect(graph.statusCode).toBe(200);
      const graphNode = graph
        .json()
        .nodes.find((entry: { nodeId: string }) => entry.nodeId === file.id);
      expect(graphNode?.hasValidationIssues).toBe(true);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server OKF convert export and MCP reads', () => {
  it('converts concepts, exports zip, and serves MCP read_index/list_concepts', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-okf-convert-'));
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
      const workspace = await workspaces.create({ slug, name: 'OKF Convert Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Convert Me' },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'runbook-alpha.md',
          content: '# Runbook\n\nSteps for alpha.\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      const convert = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/convert-to-okf`,
        payload: { synthesizeIndex: true },
      });
      expect(convert.statusCode).toBe(200);
      expect(convert.json().updated).toBeGreaterThan(0);

      const updatedCorpus = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}`,
      });
      expect(updatedCorpus.json().settings.formatProfile).toBe('okf');

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const nodesResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      const indexedNode = nodesResponse
        .json()
        .find((entry: { id: string }) => entry.id === file.id);
      expect(indexedNode?.metadata?.frontmatter?.type).toBe('Playbook');

      const exportZip = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/export-okf`,
      });
      expect(exportZip.statusCode).toBe(200);
      expect(exportZip.headers['content-type']).toContain('application/zip');
      expect(exportZip.rawPayload.length).toBeGreaterThan(0);

      const readIndex = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.read_index',
          { corpusId: corpus.id },
          { 'x-evukb-workspace-id': workspace.id },
        ),
      );
      expect(readIndex?.isError).not.toBe(true);
      const indexPayload = readIndex?.structuredContent as { content?: string | null };
      expect(indexPayload.content).toContain('runbook-alpha');

      const listConcepts = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.list_concepts',
          { corpusId: corpus.id, conceptType: 'Playbook' },
          { 'x-evukb-workspace-id': workspace.id },
        ),
      );
      expect(listConcepts?.isError).not.toBe(true);
      const conceptsPayload = listConcepts?.structuredContent as {
        concepts?: Array<{ path?: string; type?: string | null }>;
      };
      expect(conceptsPayload.concepts?.some((entry) => entry.path === 'runbook-alpha.md')).toBe(
        true,
      );
      expect(conceptsPayload.concepts?.every((entry) => entry.type === 'Playbook')).toBe(true);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server OKF maintenance and strict saves', () => {
  it('maintains index.md on concept save and blocks invalid strict saves', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-okf-maintain-'));
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
      const workspace = await workspaces.create({ slug, name: 'OKF Maintain Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Maintain Me', settings: { formatProfile: 'okf' } },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'alpha.md',
          content: '---\ntype: Document\ntitle: Alpha\n---\n\nAlpha body.\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      let indexBody = '';
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const nodesAfterCreate = await server.inject({
          method: 'GET',
          url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
        });
        const indexNode = nodesAfterCreate
          .json()
          .find((entry: { name: string }) => entry.name === 'index.md');
        if (indexNode) {
          const indexContent = await server.inject({
            method: 'GET',
            url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${indexNode.id}/content`,
          });
          if (indexContent.statusCode === 200 && indexContent.body.includes('alpha.md')) {
            indexBody = indexContent.body;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(indexBody).toContain('alpha.md');

      const enableStrict = await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}`,
        payload: { settings: { formatProfile: 'okf', okfStrict: true } },
      });
      expect(enableStrict.statusCode).toBe(200);

      const blockedSave = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
        headers: { 'content-type': 'text/plain' },
        payload: '# Missing type\n\nInvalid under strict.\n',
      });
      expect(blockedSave.statusCode).toBe(400);
      expect(blockedSave.json().code).toBe('validation_error');

      const allowedSave = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
        headers: { 'content-type': 'text/plain' },
        payload: '---\ntype: Document\ntitle: Alpha\n---\n\nUpdated body.\n',
      });
      expect(allowedSave.statusCode).toBe(200);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server OKF citation validation jobs', () => {
  it('validates citation URLs and records metadata issues for blocked hosts', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-citation-'));
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
      const workspace = await workspaces.create({ slug, name: 'Citation Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Citations', settings: { formatProfile: 'okf' } },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'cited.md',
          content: [
            '---',
            'type: Document',
            'title: Cited',
            '---',
            '',
            '## Citations',
            '',
            '- [Blocked](http://127.0.0.1/secret)',
          ].join('\n'),
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);
      await waitForBackgroundJobs(server, 25_000);

      const nodesResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      const node = nodesResponse.json().find((entry: { id: string }) => entry.id === file.id);
      expect(node?.metadata?.citationValidation?.entries?.[0]?.status).toBe('blocked');

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      expect(stats.json().citationIssueCount).toBeGreaterThan(0);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
