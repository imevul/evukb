import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';
import { describeIfDb, requireDatabaseUrl, waitForBackgroundJobs } from './helpers.js';

describeIfDb('kb-server git writeback', () => {
  it('imports a git corpus, allows edits when writeback is enabled, and commits to cache', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-git-wb-int-'));
    const bare = join(root, 'remote.git');
    const seed = join(root, 'seed');
    const blobRoot = join(root, 'blobs');
    mkdirSync(seed, { recursive: true });
    mkdirSync(blobRoot, { recursive: true });

    execFileSync('git', ['init', '--bare', bare]);
    execFileSync('git', ['init', seed]);
    execFileSync('git', ['-C', seed, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', seed, 'config', 'user.name', 'Test']);
    writeFileSync(join(seed, 'synced.md'), '# Synced git note\n', 'utf8');
    execFileSync('git', ['-C', seed, 'add', 'synced.md']);
    execFileSync('git', ['-C', seed, 'commit', '-m', 'seed']);
    execFileSync('git', ['-C', seed, 'branch', '-M', 'main']);
    execFileSync('git', ['-C', seed, 'remote', 'add', 'origin', bare]);
    execFileSync('git', ['-C', seed, 'push', '-u', 'origin', 'main']);

    const previousGate = process.env.EVUKB_ENABLE_GIT_WRITEBACK;
    process.env.EVUKB_ENABLE_GIT_WRITEBACK = 'true';

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
          name: `Git Writeback ${randomUUID()}`,
          settings: {
            importKind: 'git',
            gitRemoteUrl: bare,
            gitRef: 'main',
            gitWritebackEnabled: true,
            gitWritebackUseFeatureBranch: true,
            gitAuthorName: 'Integration',
            gitAuthorEmail: 'integration@example.com',
          },
        },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const syncResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/sync-git`,
      });
      expect(syncResponse.statusCode).toBe(200);

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
      expect(syncedNode.mutability?.editable).toBe(true);

      const saveResponse = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/nodes/${syncedNode.id}/content`,
        headers: { 'content-type': 'text/plain' },
        payload: '# Written back from EvuKB\n',
      });
      expect(saveResponse.statusCode).toBe(200);

      await waitForBackgroundJobs(server, 30_000);

      const stats = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora/${corpus.id}/stats`,
      });
      expect(stats.statusCode).toBe(200);
      const syncStatus = stats.json().syncStatus as {
        lastSyncStatus?: string;
        lastCommitSha?: string;
        lastWritebackError?: string;
      };
      expect(syncStatus.lastSyncStatus).not.toBe('writeback_blocked');
      expect(syncStatus.lastCommitSha).toBeTruthy();

      if (!workspace) {
        throw new Error('Expected local-dev workspace.');
      }
      const cacheDir = join(blobRoot, '.git-cache', workspace.id, corpus.id);
      const log = execFileSync('git', ['-C', cacheDir, 'log', '-1', '--pretty=%s'], {
        encoding: 'utf8',
      });
      expect(log).toContain('EvuKB writeback');

      await server.close();
    } finally {
      if (previousGate === undefined) {
        delete process.env.EVUKB_ENABLE_GIT_WRITEBACK;
      } else {
        process.env.EVUKB_ENABLE_GIT_WRITEBACK = previousGate;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects gitWritebackEnabled when env gate is off', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-git-wb-gate-'));
    const previousGate = process.env.EVUKB_ENABLE_GIT_WRITEBACK;
    delete process.env.EVUKB_ENABLE_GIT_WRITEBACK;

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

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace?.id}/knowledge-corpora`,
        payload: {
          name: `Git Gate ${randomUUID()}`,
          settings: {
            importKind: 'git',
            gitRemoteUrl: 'https://example.com/repo.git',
            gitWritebackEnabled: true,
          },
        },
      });
      expect(createCorpus.statusCode).toBe(400);
      expect(String(createCorpus.json().error ?? '')).toContain('EVUKB_ENABLE_GIT_WRITEBACK');

      await server.close();
    } finally {
      if (previousGate === undefined) {
        delete process.env.EVUKB_ENABLE_GIT_WRITEBACK;
      } else {
        process.env.EVUKB_ENABLE_GIT_WRITEBACK = previousGate;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
