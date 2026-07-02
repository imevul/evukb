/**
 * Qdrant integration tests require:
 *   docker compose -f deploy/docker-compose.dev.yml --profile qdrant up -d qdrant
 *   EVUKB_DATABASE_URL=... EVUKB_QDRANT_URL=http://localhost:6333
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEvuKbServer, waitForJobIdle } from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const qdrantUrl = process.env.EVUKB_QDRANT_URL;
const describeIfQdrant = databaseUrl && qdrantUrl ? describe : describe.skip;

if (databaseUrl && qdrantUrl) {
  vi.setConfig({ testTimeout: 60_000 });
}

function requireDatabaseUrl(): string {
  if (!databaseUrl) {
    throw new Error('EVUKB_DATABASE_URL is required for Qdrant integration tests.');
  }
  return databaseUrl;
}

async function waitForBackgroundJobs(
  server: Awaited<ReturnType<typeof createEvuKbServer>>,
  timeoutMs = 20_000,
): Promise<void> {
  await waitForJobIdle(server.evuKbRuntime?.jobQueue, timeoutMs);
}

async function waitForNodeIndexed(
  server: Awaited<ReturnType<typeof createEvuKbServer>>,
  workspaceId: string,
  corpusId: string,
  nodeId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const nodesResponse = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/knowledge-corpora/${corpusId}/nodes?format=flat`,
    });
    const node = nodesResponse.json().find((entry: { id: string }) => entry.id === nodeId);
    if (node?.indexStatus === 'indexed') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for node ${nodeId} to become indexed.`);
}

describeIfQdrant('kb-server Qdrant vector backend', () => {
  const envSnapshot = {
    vectorBackend: process.env.EVUKB_VECTOR_BACKEND,
    qdrantUrl: process.env.EVUKB_QDRANT_URL,
  };

  afterEach(() => {
    if (envSnapshot.vectorBackend === undefined) {
      delete process.env.EVUKB_VECTOR_BACKEND;
    } else {
      process.env.EVUKB_VECTOR_BACKEND = envSnapshot.vectorBackend;
    }
    if (envSnapshot.qdrantUrl === undefined) {
      delete process.env.EVUKB_QDRANT_URL;
    } else {
      process.env.EVUKB_QDRANT_URL = envSnapshot.qdrantUrl;
    }
  });

  it('reports healthy Qdrant backend and returns keyword search hits', async () => {
    process.env.EVUKB_VECTOR_BACKEND = 'qdrant';
    process.env.EVUKB_QDRANT_URL = qdrantUrl;

    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-qdrant-blob-'));
    const slug = `qdrant-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: requireDatabaseUrl(),
        bootstrapDevWorkspace: false,
      });

      const health = await server.inject('/health/vector-store');
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({
        backend: 'qdrant',
        status: 'ok',
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Qdrant Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Qdrant Docs' },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'qdrant-target.md',
          content: '# Qdrant Target\n\nEvuKB qdrant integration fixture keyword zeta.\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const search = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'zeta fixture' },
      });
      expect(search.statusCode).toBe(200);
      expect(search.json().length).toBeGreaterThan(0);
      expect(search.json()[0]?.bodyPreview).toContain('zeta');

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
