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

describeIfDb('kb-server link graph routes', () => {
  it('returns corpus link graph, node links, and MCP neighborhood with workspace isolation', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-links-'));
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
      const workspace = await workspaces.create({ slug, name: 'Link Graph Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const uploadSource = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'source.md',
          content: '# Source\n\nSee [[target]] for details.\n',
        },
      });
      const source = uploadSource.json();

      await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'target.md',
          content: '# Target\n\nLinked destination.\n',
        },
      });

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, source.id);

      const reindex = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex`,
        payload: { nodeIds: [source.id] },
      });
      expect(reindex.statusCode).toBe(200);
      expect(reindex.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, source.id);

      const linkGraph = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/link-graph`,
      });
      expect(linkGraph.statusCode).toBe(200);
      const graph = linkGraph.json();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.some((edge: { raw?: string }) => edge.raw?.includes('target'))).toBe(true);

      const nodeLinks = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${source.id}/links`,
      });
      expect(nodeLinks.statusCode).toBe(200);
      expect(nodeLinks.json().length).toBeGreaterThan(0);

      const neighborhood = parseMcpToolResult(
        await callMcpTool(
          server,
          'evu.kb.graph_neighborhood',
          { corpusId: corpus.id, nodeId: source.id, depth: 1 },
          { 'x-evukb-workspace-id': workspace.id },
        ),
      );
      expect(neighborhood?.isError).not.toBe(true);
      const neighborhoodPayload = neighborhood?.structuredContent as {
        centerNodeId?: string;
        nodes?: unknown[];
      };
      expect(neighborhoodPayload.centerNodeId).toBe(source.id);
      expect(neighborhoodPayload.nodes?.length).toBeGreaterThan(0);

      const httpNeighborhood = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${source.id}/graph/neighborhood?depth=1`,
      });
      expect(httpNeighborhood.statusCode).toBe(200);
      expect(httpNeighborhood.json().centerNodeId).toBe(source.id);
      expect(httpNeighborhood.json().nodes.length).toBeGreaterThan(0);

      const wrongWorkspace = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/link-graph`,
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server corpus stats and link resolution', () => {
  it('persists resolved links at index time and exposes corpus stats', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-stats-'));
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
      const workspace = await workspaces.create({ slug, name: 'Stats Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'target.md',
          content: '# Target\n\nDestination page.\n',
        },
      });

      const uploadSource = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'source.md',
          content: '# Source\n\nSee [[target]] for details.\n',
        },
      });
      const source = uploadSource.json();

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, source.id);

      const reindex = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex`,
        payload: { nodeIds: [source.id] },
      });
      expect(reindex.statusCode).toBe(200);
      expect(reindex.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, source.id);

      const linkGraph = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/link-graph`,
      });
      expect(linkGraph.statusCode).toBe(200);
      const graph = linkGraph.json();
      expect(graph.edges.some((edge: { resolved?: boolean }) => edge.resolved === true)).toBe(true);

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      const body = stats.json();
      expect(body.linkCounts.internal).toBeGreaterThan(0);
      expect(body.linkCounts.unresolved).toBe(0);
      expect(body.fileCount).toBeGreaterThanOrEqual(2);

      const wrongWorkspace = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
