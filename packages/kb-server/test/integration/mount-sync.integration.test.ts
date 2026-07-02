import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  describeIfDb,
  requireDatabaseUrl,
  waitForBackgroundJobs,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server mount sync routes', () => {
  it('imports mount files, indexes them, and blocks saves on synced nodes', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-mount-sync-blob-'));
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-mount-sync-src-'));
    writeFileSync(join(mountRoot, 'synced.md'), '# Synced mount note\n', 'utf8');
    const previousAllowlist = process.env.EVUKB_MOUNT_ALLOWLIST;
    process.env.EVUKB_MOUNT_ALLOWLIST = mountRoot;

    try {
      const server = await createEvuKbServer({
        connectionString: requireDatabaseUrl(),
        blobRoot,
        bootstrapDevWorkspace: true,
        logger: false,
      });

      const workspace = server.evuKbRuntime?.workspaces
        ? await server.evuKbRuntime.workspaces.getBySlug('local-dev')
        : null;
      expect(workspace).toBeTruthy();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora`,
        payload: {
          name: `Mount Sync ${randomUUID()}`,
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import',
          },
        },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const syncResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/sync-mount`,
      });
      expect(syncResponse.statusCode).toBe(200);
      expect(syncResponse.json().enqueued).toBe(true);

      await waitForBackgroundJobs(server, 30_000);

      const nodesResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      expect(nodesResponse.statusCode).toBe(200);
      const syncedNode = nodesResponse
        .json()
        .find((entry: { name: string }) => entry.name === 'synced.md');
      expect(syncedNode).toBeTruthy();
      expect(syncedNode.mutability?.editable).toBe(false);

      const readContent = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes/${syncedNode.id}/content`,
      });
      expect(readContent.statusCode).toBe(200);
      expect(readContent.body).toContain('Synced mount note');

      const saveAttempt = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes/${syncedNode.id}/content`,
        headers: { 'content-type': 'text/plain' },
        payload: '# Changed\n',
      });
      expect(saveAttempt.statusCode).toBe(403);

      if (!workspace) {
        throw new Error('Expected local-dev workspace.');
      }
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, syncedNode.id);

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      expect(stats.json().importKind).toBe('mount');

      await server.close();
    } finally {
      if (previousAllowlist === undefined) {
        delete process.env.EVUKB_MOUNT_ALLOWLIST;
      } else {
        process.env.EVUKB_MOUNT_ALLOWLIST = previousAllowlist;
      }
      rmSync(blobRoot, { recursive: true, force: true });
      rmSync(mountRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server import_writeback mount sync', () => {
  it('mirrors managed create, save, and delete to the mount when enabled', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-writeback-blob-'));
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-writeback-mount-'));
    const previousAllowlist = process.env.EVUKB_MOUNT_ALLOWLIST;
    const previousWriteback = process.env.EVUKB_ENABLE_IMPORT_WRITEBACK;
    process.env.EVUKB_MOUNT_ALLOWLIST = mountRoot;
    process.env.EVUKB_ENABLE_IMPORT_WRITEBACK = 'true';

    try {
      const server = await createEvuKbServer({
        connectionString: requireDatabaseUrl(),
        blobRoot,
        bootstrapDevWorkspace: true,
        logger: false,
      });

      const workspace = server.evuKbRuntime?.workspaces
        ? await server.evuKbRuntime.workspaces.getBySlug('local-dev')
        : null;
      expect(workspace).toBeTruthy();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora`,
        payload: {
          name: `Writeback ${randomUUID()}`,
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const createFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'writeback-note.md',
          content: '# Initial writeback\n',
        },
      });
      expect(createFile.statusCode).toBe(201);
      const file = createFile.json();

      const mountPath = join(mountRoot, 'writeback-note.md');
      expect(readFileSync(mountPath, 'utf8')).toBe('# Initial writeback\n');

      const saveFile = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
        headers: { 'content-type': 'text/plain' },
        payload: '# Updated writeback\n',
      });
      expect(saveFile.statusCode).toBe(200);
      expect(readFileSync(mountPath, 'utf8')).toBe('# Updated writeback\n');

      const deleteNodes = await server.inject({
        method: 'DELETE',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes`,
        payload: { nodeIds: [file.id] },
      });
      expect(deleteNodes.statusCode).toBe(200);
      expect(() => readFileSync(mountPath, 'utf8')).toThrow();

      await server.close();
    } finally {
      if (previousAllowlist === undefined) {
        delete process.env.EVUKB_MOUNT_ALLOWLIST;
      } else {
        process.env.EVUKB_MOUNT_ALLOWLIST = previousAllowlist;
      }
      if (previousWriteback === undefined) {
        delete process.env.EVUKB_ENABLE_IMPORT_WRITEBACK;
      } else {
        process.env.EVUKB_ENABLE_IMPORT_WRITEBACK = previousWriteback;
      }
      rmSync(blobRoot, { recursive: true, force: true });
      rmSync(mountRoot, { recursive: true, force: true });
    }
  });

  it('reports writeback drift in corpus stats when mount file is edited externally', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-writeback-drift-blob-'));
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-writeback-drift-mount-'));
    const previousAllowlist = process.env.EVUKB_MOUNT_ALLOWLIST;
    const previousWriteback = process.env.EVUKB_ENABLE_IMPORT_WRITEBACK;
    process.env.EVUKB_MOUNT_ALLOWLIST = mountRoot;
    process.env.EVUKB_ENABLE_IMPORT_WRITEBACK = 'true';

    try {
      const server = await createEvuKbServer({
        connectionString: requireDatabaseUrl(),
        blobRoot,
        bootstrapDevWorkspace: true,
        logger: false,
      });

      const workspace = server.evuKbRuntime?.workspaces
        ? await server.evuKbRuntime.workspaces.getBySlug('local-dev')
        : null;
      expect(workspace).toBeTruthy();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora`,
        payload: {
          name: `Writeback drift ${randomUUID()}`,
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        },
      });
      const corpus = createCorpus.json();

      const createFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'drift-note.md',
          content: '# KB version\n',
        },
      });
      expect(createFile.statusCode).toBe(201);
      const mountPath = join(mountRoot, 'drift-note.md');
      writeFileSync(mountPath, '# external mount edit\n', 'utf8');

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      expect(
        stats
          .json()
          .warnings.some((warning: string) => warning.includes('differ from mount mirror')),
      ).toBe(true);

      await server.close();
    } finally {
      if (previousAllowlist === undefined) {
        delete process.env.EVUKB_MOUNT_ALLOWLIST;
      } else {
        process.env.EVUKB_MOUNT_ALLOWLIST = previousAllowlist;
      }
      if (previousWriteback === undefined) {
        delete process.env.EVUKB_ENABLE_IMPORT_WRITEBACK;
      } else {
        process.env.EVUKB_ENABLE_IMPORT_WRITEBACK = previousWriteback;
      }
      rmSync(blobRoot, { recursive: true, force: true });
      rmSync(mountRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server mount_authoritative sync', () => {
  it('deletes managed orphans not present on mount during sync', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-auth-blob-'));
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-auth-mount-'));
    writeFileSync(join(mountRoot, 'on-mount.md'), '# On mount\n', 'utf8');
    const previousAllowlist = process.env.EVUKB_MOUNT_ALLOWLIST;
    const previousAuthoritative = process.env.EVUKB_ENABLE_MOUNT_AUTHORITATIVE;
    process.env.EVUKB_MOUNT_ALLOWLIST = mountRoot;
    process.env.EVUKB_ENABLE_MOUNT_AUTHORITATIVE = 'true';

    try {
      const server = await createEvuKbServer({
        connectionString: requireDatabaseUrl(),
        blobRoot,
        bootstrapDevWorkspace: true,
        logger: false,
      });

      const workspace = server.evuKbRuntime?.workspaces
        ? await server.evuKbRuntime.workspaces.getBySlug('local-dev')
        : null;
      expect(workspace).toBeTruthy();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora`,
        payload: {
          name: `Authoritative ${randomUUID()}`,
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'mount_authoritative',
          },
        },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const initialSync = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/sync-mount`,
      });
      expect(initialSync.statusCode).toBe(200);
      await waitForBackgroundJobs(server, 30_000);

      const orphan = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'orphan-managed.md',
          content: '# Orphan managed\n',
        },
      });
      expect(orphan.statusCode).toBe(201);
      const orphanId = orphan.json().id;

      const resync = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/sync-mount`,
      });
      expect(resync.statusCode).toBe(200);
      await waitForBackgroundJobs(server, 30_000);

      const nodesResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      expect(nodesResponse.statusCode).toBe(200);
      const nodeIds = nodesResponse.json().map((entry: { id: string }) => entry.id);
      expect(nodeIds).not.toContain(orphanId);
      expect(
        nodesResponse.json().some((entry: { name: string }) => entry.name === 'on-mount.md'),
      ).toBe(true);

      await server.close();
    } finally {
      if (previousAllowlist === undefined) {
        delete process.env.EVUKB_MOUNT_ALLOWLIST;
      } else {
        process.env.EVUKB_MOUNT_ALLOWLIST = previousAllowlist;
      }
      if (previousAuthoritative === undefined) {
        delete process.env.EVUKB_ENABLE_MOUNT_AUTHORITATIVE;
      } else {
        process.env.EVUKB_ENABLE_MOUNT_AUTHORITATIVE = previousAuthoritative;
      }
      rmSync(blobRoot, { recursive: true, force: true });
      rmSync(mountRoot, { recursive: true, force: true });
    }
  });
});
