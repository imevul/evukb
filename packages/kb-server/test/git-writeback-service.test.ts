import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { asCorpusId, asWorkspaceId, createBlobRef, LocalFilesystemBlobStore } from '@evu/kb-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GitWritebackService } from '../src/services/git-writeback-service.js';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

describe('GitWritebackService', () => {
  const roots: string[] = [];
  const previousEnv = process.env.EVUKB_ENABLE_GIT_WRITEBACK;

  beforeEach(() => {
    process.env.EVUKB_ENABLE_GIT_WRITEBACK = 'true';
  });

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.EVUKB_ENABLE_GIT_WRITEBACK;
    } else {
      process.env.EVUKB_ENABLE_GIT_WRITEBACK = previousEnv;
    }
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('commits upserts into the workspace-scoped git cache without force-push', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-git-wb-'));
    roots.push(root);
    const bare = join(root, 'remote.git');
    const seed = join(root, 'seed');
    const blobRoot = join(root, 'blobs');
    mkdirSync(seed, { recursive: true });
    mkdirSync(blobRoot, { recursive: true });

    execFileSync('git', ['init', '--bare', bare]);
    execFileSync('git', ['init', seed]);
    execFileSync('git', ['-C', seed, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', seed, 'config', 'user.name', 'Test']);
    writeFileSync(join(seed, 'note.md'), '# Seed\n', 'utf8');
    execFileSync('git', ['-C', seed, 'add', 'note.md']);
    execFileSync('git', ['-C', seed, 'commit', '-m', 'seed']);
    execFileSync('git', ['-C', seed, 'branch', '-M', 'main']);
    execFileSync('git', ['-C', seed, 'remote', 'add', 'origin', bare]);
    execFileSync('git', ['-C', seed, 'push', '-u', 'origin', 'main']);

    const workspaceId = '11111111-1111-4111-8111-111111111111';
    const corpusId = '22222222-2222-4222-8222-222222222222';
    const cacheDir = join(blobRoot, '.git-cache', workspaceId, corpusId);
    mkdirSync(join(blobRoot, '.git-cache', workspaceId), { recursive: true });
    execFileSync('git', ['clone', bare, cacheDir]);
    execFileSync('git', ['-C', cacheDir, 'config', 'user.email', 'cache@example.com']);
    execFileSync('git', ['-C', cacheDir, 'config', 'user.name', 'Cache']);

    const nodeId = '33333333-3333-4333-8333-333333333333';
    const storageRelPath = `nodes/${nodeId}.md`;
    const blobStore = new LocalFilesystemBlobStore({ rootDir: blobRoot });
    await blobStore.put({
      ref: createBlobRef(asWorkspaceId(workspaceId), asCorpusId(corpusId), storageRelPath),
      body: Buffer.from('# Updated from KB\n', 'utf8'),
      contentHash: 'abc',
    });

    const updateSyncStatus = vi.fn(async () => undefined);
    const auditLog = { record: vi.fn(async () => undefined) };

    const service = new GitWritebackService({
      auditLog: auditLog as never,
      blobRoot,
      blobStore,
      corpora: {
        getById: vi.fn(async () => ({
          id: corpusId,
          workspaceId,
          settings: {
            importKind: 'git',
            gitRemoteUrl: bare,
            gitRef: 'main',
            gitWritebackEnabled: true,
            gitWritebackUseFeatureBranch: true,
            gitAuthorName: 'EvuKB Test',
            gitAuthorEmail: 'writeback@example.com',
          },
        })),
      } as never,
      jobQueue: { enqueueGitWriteback: vi.fn(async () => 'job-1') } as never,
      nodes: {
        getById: vi.fn(async () => ({
          id: nodeId,
          path: '',
          name: 'note.md',
          sourceType: 'git',
          nodeType: 'file',
          storageRelPath,
        })),
      } as never,
      secrets: { getByName: vi.fn() } as never,
      syncImport: { updateSyncStatus } as never,
      env: { EVUKB_ENABLE_GIT_WRITEBACK: 'true' },
    });

    const result = await service.runWriteback({
      workspaceId,
      corpusId,
      changes: [{ relativePath: 'note.md', op: 'upsert', nodeId }],
    });

    expect(result.committed).toBe(true);
    expect(result.blocked).toBeFalsy();
    expect(result.branch).toBe(`evukb/writeback/${corpusId}`);
    expect(readFileSync(join(cacheDir, 'note.md'), 'utf8')).toContain('Updated from KB');
    expect(git(cacheDir, ['log', '-1', '--pretty=%s'])).toContain('EvuKB writeback');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'git_writeback_commit',
        workspaceId,
      }),
    );
    expect(updateSyncStatus).toHaveBeenCalledWith(
      workspaceId,
      corpusId,
      expect.objectContaining({
        lastSyncStatus: 'success',
        lastCommitSha: result.commitSha,
      }),
    );
  });

  it('blocks default-branch writeback without explicit allow', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-git-wb-block-'));
    roots.push(root);
    const service = new GitWritebackService({
      blobRoot: root,
      blobStore: {
        get: async () => Readable.from([Buffer.from('x')]),
      } as never,
      corpora: {
        getById: vi.fn(async () => ({
          id: 'c1',
          workspaceId: 'w1',
          settings: {
            importKind: 'git',
            gitRemoteUrl: 'https://example.com/r.git',
            gitRef: 'main',
            gitWritebackEnabled: true,
          },
        })),
      } as never,
      jobQueue: {} as never,
      nodes: {} as never,
      secrets: {} as never,
      syncImport: {
        updateSyncStatus: vi.fn(async () => undefined),
      } as never,
      env: { EVUKB_ENABLE_GIT_WRITEBACK: 'true' },
    });

    const result = await service.runWriteback({
      workspaceId: 'w1',
      corpusId: 'c1',
      changes: [{ relativePath: 'a.md', op: 'upsert', nodeId: 'n1' }],
    });

    expect(result.blocked).toBe(true);
    expect(result.error).toContain('gitWritebackAllowDefaultBranch');
  });
});
