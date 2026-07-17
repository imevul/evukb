import { execFile } from 'node:child_process';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  createBlobRef,
  isCorpusGitWritebackActive,
  isGitWritebackDefaultBranchTarget,
  isGitWritebackEnabled,
  isPathWithinRoot,
  parseCorpusSyncSettings,
  resolveGitWritebackBranch,
  type SyncStatus,
  shouldGitWritebackNode,
} from '@evu/kb-core';
import type {
  AuditLogRepository,
  CorpusRepository,
  NodeRepository,
  SecretRepository,
} from '@evu/kb-db';

import { decryptStoredSecret } from '../auth/secret-crypto.js';
import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { GitWritebackChange, GitWritebackJob } from '../jobs/types.js';
import type { SyncImportService } from './sync-import-service.js';

const execFileAsync = promisify(execFile);

const MAX_AUDITED_PATHS = 20;

export type GitWritebackServiceDeps = {
  auditLog?: AuditLogRepository;
  blobRoot: string;
  blobStore: BlobStore;
  corpora: CorpusRepository;
  env?: Record<string, string | undefined>;
  gitCacheRoot?: string;
  jobQueue: JobQueueService;
  nodes: NodeRepository;
  secrets: SecretRepository;
  syncImport: SyncImportService;
};

export type GitWritebackResult = {
  committed: boolean;
  pushed: boolean;
  commitSha?: string;
  branch: string;
  paths: string[];
  blocked?: boolean;
  error?: string;
};

export class GitWritebackService {
  readonly #auditLog: AuditLogRepository | undefined;
  readonly #blobRoot: string;
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #env: Record<string, string | undefined>;
  readonly #gitCacheRoot: string | undefined;
  readonly #jobQueue: JobQueueService;
  readonly #nodes: NodeRepository;
  readonly #secrets: SecretRepository;
  readonly #syncImport: SyncImportService;

  constructor(deps: GitWritebackServiceDeps) {
    this.#auditLog = deps.auditLog;
    this.#blobRoot = deps.blobRoot;
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#env = deps.env ?? process.env;
    this.#gitCacheRoot = deps.gitCacheRoot;
    this.#jobQueue = deps.jobQueue;
    this.#nodes = deps.nodes;
    this.#secrets = deps.secrets;
    this.#syncImport = deps.syncImport;
  }

  async enqueueNodeUpsert(
    workspaceId: string,
    corpusId: string,
    node: { id: string; path: string; name: string; sourceType: string; nodeType: string },
  ): Promise<string | null> {
    if (!shouldGitWritebackNode(node)) {
      return null;
    }
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus || !isCorpusGitWritebackActive(corpus.settings, this.#env)) {
      return null;
    }
    const relativePath = node.path ? `${node.path}/${node.name}` : node.name;
    return this.#jobQueue.enqueueGitWriteback({
      workspaceId,
      corpusId,
      changes: [{ relativePath, op: 'upsert', nodeId: node.id }],
    });
  }

  async enqueueNodeDelete(
    workspaceId: string,
    corpusId: string,
    node: { path: string; name: string; sourceType: string; nodeType: string },
  ): Promise<string | null> {
    if (!shouldGitWritebackNode(node)) {
      return null;
    }
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus || !isCorpusGitWritebackActive(corpus.settings, this.#env)) {
      return null;
    }
    const relativePath = node.path ? `${node.path}/${node.name}` : node.name;
    return this.#jobQueue.enqueueGitWriteback({
      workspaceId,
      corpusId,
      changes: [{ relativePath, op: 'delete' }],
    });
  }

  async runWriteback(job: GitWritebackJob): Promise<GitWritebackResult> {
    const corpus = await this.#corpora.getById(job.workspaceId, job.corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(job.corpusId);
    }

    const branch = resolveGitWritebackBranch(corpus.settings, job.corpusId);
    const paths = job.changes.map((change) => change.relativePath);

    if (!isGitWritebackEnabled(this.#env)) {
      return this.#failClosed(
        job,
        branch,
        paths,
        'Git writeback requires EVUKB_ENABLE_GIT_WRITEBACK=true.',
        true,
      );
    }

    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (syncSettings.importKind !== 'git' || !syncSettings.gitWritebackEnabled) {
      return this.#failClosed(
        job,
        branch,
        paths,
        'Corpus is not configured for git writeback.',
        true,
      );
    }

    if (
      isGitWritebackDefaultBranchTarget(corpus.settings, job.corpusId) &&
      syncSettings.gitWritebackAllowDefaultBranch !== true
    ) {
      return this.#failClosed(
        job,
        branch,
        paths,
        `Direct writeback to default branch "${branch}" requires gitWritebackAllowDefaultBranch=true (or enable a feature branch).`,
        true,
      );
    }

    if (!syncSettings.gitRemoteUrl) {
      return this.#failClosed(job, branch, paths, 'Corpus gitRemoteUrl is not configured.', true);
    }

    const cacheDir = this.#cacheDir(job.workspaceId, job.corpusId);
    const gitDirExists = await stat(path.join(cacheDir, '.git')).then(
      (entry) => entry.isDirectory(),
      () => false,
    );
    if (!gitDirExists) {
      return this.#failClosed(
        job,
        branch,
        paths,
        'Git cache is missing; run git sync before writeback.',
        true,
      );
    }

    const gitEnv = await this.#buildGitEnv(job.workspaceId, syncSettings.gitCredentialSecretName);

    try {
      const author = await this.#resolveAuthor(job.workspaceId, syncSettings);
      await this.#prepareBranch(cacheDir, branch, gitEnv);
      const diverged = await this.#isDiverged(cacheDir, branch, gitEnv);
      if (diverged) {
        return this.#failClosed(
          job,
          branch,
          paths,
          'Git history has diverged; writeback blocked until the operator reconciles the cache.',
          true,
        );
      }

      await this.#applyChanges(job.workspaceId, job.corpusId, cacheDir, job.changes);
      const staged = await this.#stageAndCommit(cacheDir, paths, author, gitEnv);
      if (!staged.commitSha) {
        await this.#recordAudit(job, 'git_writeback_commit', {
          branch,
          paths: paths.slice(0, MAX_AUDITED_PATHS),
          pathCount: paths.length,
          skipped: true,
          reason: 'no_changes',
        });
        return {
          committed: false,
          pushed: false,
          branch,
          paths,
        };
      }

      await this.#recordAudit(job, 'git_writeback_commit', {
        branch,
        paths: paths.slice(0, MAX_AUDITED_PATHS),
        pathCount: paths.length,
        commitSha: staged.commitSha,
        ...(job.approvalId ? { approvalId: job.approvalId } : {}),
      });

      let pushed = false;
      if (syncSettings.gitPushEnabled) {
        try {
          await this.#push(cacheDir, branch, gitEnv);
          pushed = true;
          await this.#recordAudit(job, 'git_writeback_push', {
            branch,
            paths: paths.slice(0, MAX_AUDITED_PATHS),
            pathCount: paths.length,
            commitSha: staged.commitSha,
            ...(job.approvalId ? { approvalId: job.approvalId } : {}),
          });
        } catch (error) {
          const message = formatGitError(error);
          if (isProtectedBranchError(message)) {
            await this.#recordAudit(job, 'git_writeback_push', {
              branch,
              paths: paths.slice(0, MAX_AUDITED_PATHS),
              pathCount: paths.length,
              error: 'protected_branch',
            });
            return this.#failClosed(
              job,
              branch,
              paths,
              `Push to protected branch "${branch}" was blocked by the remote.`,
              true,
              staged.commitSha,
            );
          }
          await this.#recordAudit(job, 'git_writeback_push', {
            branch,
            paths: paths.slice(0, MAX_AUDITED_PATHS),
            pathCount: paths.length,
            error: message,
          });
          return this.#failClosed(job, branch, paths, message, true, staged.commitSha);
        }
      }

      await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
        lastCommitSha: staged.commitSha,
        lastWritebackAt: new Date().toISOString(),
        lastWritebackError: null,
        lastSyncError: null,
      });

      return {
        committed: true,
        pushed,
        commitSha: staged.commitSha,
        branch,
        paths,
      };
    } catch (error) {
      const message = formatGitError(error);
      await this.#recordAudit(job, 'git_writeback_commit', {
        branch,
        paths: paths.slice(0, MAX_AUDITED_PATHS),
        pathCount: paths.length,
        error: message,
      });
      return this.#failClosed(job, branch, paths, message, true);
    }
  }

  async #failClosed(
    job: GitWritebackJob,
    branch: string,
    paths: string[],
    error: string,
    blocked = false,
    commitSha?: string,
  ): Promise<GitWritebackResult> {
    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'writeback_blocked',
      lastSyncError: error,
      lastWritebackAt: new Date().toISOString(),
      lastWritebackError: error,
      ...(commitSha ? { lastCommitSha: commitSha } : {}),
    };
    await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, status);
    return {
      committed: Boolean(commitSha),
      pushed: false,
      ...(commitSha ? { commitSha } : {}),
      branch,
      paths,
      blocked,
      error,
    };
  }

  #cacheDir(workspaceId: string, corpusId: string): string {
    const root = this.#gitCacheRoot ?? this.#env.EVUKB_GIT_CACHE_ROOT ?? this.#blobRoot;
    return path.join(root, '.git-cache', workspaceId, corpusId);
  }

  async #prepareBranch(cacheDir: string, branch: string, env: NodeJS.ProcessEnv): Promise<void> {
    await execFileAsync('git', ['-C', cacheDir, 'fetch', 'origin', branch], { env }).catch(
      async () => {
        await execFileAsync('git', ['-C', cacheDir, 'fetch', 'origin'], { env });
      },
    );

    const localExists = await execFileAsync(
      'git',
      ['-C', cacheDir, 'rev-parse', '--verify', branch],
      { env },
    ).then(
      () => true,
      () => false,
    );

    if (localExists) {
      await execFileAsync('git', ['-C', cacheDir, 'checkout', branch], { env });
      return;
    }

    const remoteExists = await execFileAsync(
      'git',
      ['-C', cacheDir, 'rev-parse', '--verify', `origin/${branch}`],
      { env },
    ).then(
      () => true,
      () => false,
    );

    if (remoteExists) {
      await execFileAsync('git', ['-C', cacheDir, 'checkout', '-B', branch, `origin/${branch}`], {
        env,
      });
      return;
    }

    await execFileAsync('git', ['-C', cacheDir, 'checkout', '-B', branch], { env });
  }

  async #isDiverged(cacheDir: string, branch: string, env: NodeJS.ProcessEnv): Promise<boolean> {
    const remoteRef = `origin/${branch}`;
    const remoteExists = await execFileAsync(
      'git',
      ['-C', cacheDir, 'rev-parse', '--verify', remoteRef],
      { env },
    ).then(
      () => true,
      () => false,
    );
    if (!remoteExists) {
      return false;
    }

    const { stdout: base } = await execFileAsync(
      'git',
      ['-C', cacheDir, 'merge-base', 'HEAD', remoteRef],
      { env },
    );
    const { stdout: head } = await execFileAsync('git', ['-C', cacheDir, 'rev-parse', 'HEAD'], {
      env,
    });
    const { stdout: remote } = await execFileAsync(
      'git',
      ['-C', cacheDir, 'rev-parse', remoteRef],
      { env },
    );

    const baseSha = base.trim();
    const headSha = head.trim();
    const remoteSha = remote.trim();
    if (headSha === remoteSha) {
      return false;
    }
    // Diverged when neither tip is an ancestor of the other (merge-base is not either tip).
    return baseSha !== headSha && baseSha !== remoteSha;
  }

  async #applyChanges(
    workspaceId: string,
    corpusId: string,
    cacheDir: string,
    changes: GitWritebackChange[],
  ): Promise<void> {
    for (const change of changes) {
      const targetPath = path.join(cacheDir, change.relativePath);
      if (!isPathWithinRoot(cacheDir, targetPath)) {
        throw new Error(`Writeback path escapes git cache: ${change.relativePath}`);
      }

      if (change.op === 'delete') {
        await unlink(targetPath).catch(() => undefined);
        continue;
      }

      if (!change.nodeId) {
        throw new Error(`Writeback upsert missing nodeId for ${change.relativePath}`);
      }
      const node = await this.#nodes.getById(workspaceId, corpusId, change.nodeId);
      if (!node?.storageRelPath) {
        throw new Error(`Writeback node missing storage path: ${change.nodeId}`);
      }
      const blobRef = createBlobRef(
        asWorkspaceId(workspaceId),
        asCorpusId(corpusId),
        node.storageRelPath,
      );
      const stream = await this.#blobStore.get(blobRef);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content);
    }
  }

  async #stageAndCommit(
    cacheDir: string,
    paths: string[],
    author: { name: string; email: string },
    env: NodeJS.ProcessEnv,
  ): Promise<{ commitSha?: string }> {
    for (const relativePath of paths) {
      const targetPath = path.join(cacheDir, relativePath);
      const exists = await stat(targetPath).then(
        () => true,
        () => false,
      );
      if (exists) {
        await execFileAsync('git', ['-C', cacheDir, 'add', '--', relativePath], { env });
      } else {
        await execFileAsync('git', ['-C', cacheDir, 'rm', '--ignore-unmatch', '--', relativePath], {
          env,
        });
      }
    }

    const { stdout: status } = await execFileAsync(
      'git',
      ['-C', cacheDir, 'status', '--porcelain'],
      { env },
    );
    if (!status.trim()) {
      return {};
    }

    const commitEnv: NodeJS.ProcessEnv = {
      ...env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
    };

    const message = `EvuKB writeback: ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? '…' : ''}`;
    await execFileAsync('git', ['-C', cacheDir, 'commit', '-m', message], { env: commitEnv });
    const { stdout } = await execFileAsync('git', ['-C', cacheDir, 'rev-parse', 'HEAD'], {
      env: commitEnv,
    });
    return { commitSha: stdout.trim() };
  }

  async #push(cacheDir: string, branch: string, env: NodeJS.ProcessEnv): Promise<void> {
    // Never pass --force / --force-with-lease.
    await execFileAsync('git', ['-C', cacheDir, 'push', 'origin', `HEAD:${branch}`], { env });
  }

  async #resolveAuthor(
    workspaceId: string,
    syncSettings: ReturnType<typeof parseCorpusSyncSettings>,
  ): Promise<{ name: string; email: string }> {
    if (syncSettings.gitAuthorSecretName) {
      const secret = await this.#secrets.getByName(workspaceId, syncSettings.gitAuthorSecretName);
      if (!secret) {
        throw ApiError.validation(
          `Git author secret not found: ${syncSettings.gitAuthorSecretName}`,
        );
      }
      const plaintext = decryptStoredSecret(secret);
      if (!plaintext) {
        throw ApiError.validation(
          `Unable to decrypt git author secret "${syncSettings.gitAuthorSecretName}".`,
        );
      }
      const parsed = parseAuthorSecret(plaintext);
      if (parsed) {
        return parsed;
      }
      throw ApiError.validation(
        `Git author secret "${syncSettings.gitAuthorSecretName}" must contain name and email.`,
      );
    }

    if (syncSettings.gitAuthorName && syncSettings.gitAuthorEmail) {
      return { name: syncSettings.gitAuthorName, email: syncSettings.gitAuthorEmail };
    }

    return { name: 'EvuKB Writeback', email: 'evukb-writeback@localhost' };
  }

  async #buildGitEnv(workspaceId: string, secretName?: string): Promise<NodeJS.ProcessEnv> {
    if (!secretName) {
      return { ...process.env };
    }

    const secret = await this.#secrets.getByName(workspaceId, secretName);
    if (!secret) {
      throw ApiError.validation(`Git credential secret not found: ${secretName}`);
    }

    const plaintext = decryptStoredSecret(secret);
    if (!plaintext) {
      throw ApiError.validation(
        `Unable to decrypt git credential secret "${secretName}". Configure EVUKB_SECRETS_KEY.`,
      );
    }

    return {
      ...process.env,
      GIT_ASKPASS: 'echo',
      GIT_TERMINAL_PROMPT: '0',
      ...(plaintext.includes(':')
        ? {
            GIT_CONFIG_COUNT: '1',
            GIT_CONFIG_KEY_0: 'http.extraHeader',
            GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(plaintext).toString('base64')}`,
          }
        : {}),
    };
  }

  async #recordAudit(
    job: GitWritebackJob,
    action: 'git_writeback_commit' | 'git_writeback_push',
    target: Record<string, unknown>,
  ): Promise<void> {
    if (!this.#auditLog) {
      return;
    }
    await this.#auditLog.record({
      workspaceId: job.workspaceId,
      action,
      actor: { kind: 'system', source: 'git_writeback' },
      target: {
        corpusId: job.corpusId,
        ...target,
      },
    });
  }
}

function formatGitError(error: unknown): string {
  if (error instanceof Error) {
    const stderr =
      'stderr' in error && typeof (error as { stderr?: unknown }).stderr === 'string'
        ? (error as { stderr: string }).stderr
        : '';
    return (stderr || error.message || 'Git writeback failed.').trim();
  }
  return 'Git writeback failed.';
}

function isProtectedBranchError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('protected branch') ||
    lower.includes('gh006') ||
    lower.includes('cannot push') ||
    lower.includes('prohibited')
  );
}

function parseAuthorSecret(plaintext: string): { name: string; email: string } | null {
  const trimmed = plaintext.trim();
  try {
    const parsed = JSON.parse(trimmed) as { name?: unknown; email?: unknown };
    if (typeof parsed.name === 'string' && typeof parsed.email === 'string') {
      const name = parsed.name.trim();
      const email = parsed.email.trim();
      if (name && email) {
        return { name, email };
      }
    }
  } catch {
    // fall through
  }
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match?.[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return null;
}
