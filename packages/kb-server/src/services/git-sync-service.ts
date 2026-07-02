import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  parseCorpusSyncSettings,
  resolveGitRef,
  resolveGitSourceType,
  type SyncImportResult,
} from '@evu/kb-core';
import type { CorpusRepository, SecretRepository } from '@evu/kb-db';

import { decryptStoredSecret } from '../auth/secret-crypto.js';
import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { GitSyncJob } from '../jobs/types.js';
import type { SyncImportService } from './sync-import-service.js';

const execFileAsync = promisify(execFile);

export type GitSyncServiceDeps = {
  blobRoot: string;
  corpora: CorpusRepository;
  gitCacheRoot?: string;
  jobQueue: JobQueueService;
  secrets: SecretRepository;
  syncImport: SyncImportService;
};

export class GitSyncService {
  readonly #blobRoot: string;
  readonly #corpora: CorpusRepository;
  readonly #gitCacheRoot: string | undefined;
  readonly #jobQueue: JobQueueService;
  readonly #secrets: SecretRepository;
  readonly #syncImport: SyncImportService;

  constructor(deps: GitSyncServiceDeps) {
    this.#blobRoot = deps.blobRoot;
    this.#corpora = deps.corpora;
    this.#gitCacheRoot = deps.gitCacheRoot;
    this.#jobQueue = deps.jobQueue;
    this.#secrets = deps.secrets;
    this.#syncImport = deps.syncImport;
  }

  async enqueueSync(workspaceId: string, corpusId: string): Promise<string | null> {
    await this.#requireGitCorpus(workspaceId, corpusId);
    await this.#syncImport.updateSyncStatus(workspaceId, corpusId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'running',
    });
    return this.#jobQueue.enqueueGitSync({ workspaceId, corpusId });
  }

  async runSync(job: GitSyncJob): Promise<SyncImportResult> {
    const corpus = await this.#requireGitCorpus(job.workspaceId, job.corpusId);
    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (!syncSettings.gitRemoteUrl) {
      throw ApiError.validation('Corpus gitRemoteUrl is not configured.');
    }

    const gitRef = resolveGitRef(corpus.settings);
    const cacheDir = this.#cacheDir(job.workspaceId, job.corpusId);

    try {
      const commitSha = await this.#syncRepository({
        workspaceId: job.workspaceId,
        cacheDir,
        remoteUrl: syncSettings.gitRemoteUrl,
        gitRef,
        ...(syncSettings.gitCredentialSecretName
          ? { secretName: syncSettings.gitCredentialSecretName }
          : {}),
      });

      const shortSha = commitSha.slice(0, 7);
      const result = await this.#syncImport.importScannedFiles({
        workspaceId: job.workspaceId,
        corpusId: job.corpusId,
        rootDir: cacheDir,
        sourceTypes: ['git', 'reference'],
        buildSourceRef: (relativePath) => `${relativePath}@${shortSha}`,
        resolveSourceType: resolveGitSourceType,
      });

      await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: result.errors.length > 0 ? 'failed' : 'success',
        lastCommitSha: commitSha,
        ...(result.errors.length > 0
          ? { lastSyncError: result.errors.slice(0, 3).join('; ') }
          : {}),
      });

      return result;
    } catch (error) {
      await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : 'Git sync failed.',
      });
      throw error;
    }
  }

  #cacheDir(workspaceId: string, corpusId: string): string {
    const root = this.#gitCacheRoot ?? process.env.EVUKB_GIT_CACHE_ROOT ?? this.#blobRoot;
    return path.join(root, '.git-cache', workspaceId, corpusId);
  }

  async #syncRepository(input: {
    workspaceId: string;
    cacheDir: string;
    remoteUrl: string;
    gitRef: string;
    secretName?: string;
  }): Promise<string> {
    await mkdir(path.dirname(input.cacheDir), { recursive: true });
    const env = await this.#buildGitEnv(input.workspaceId, input.secretName);
    const exists = await stat(path.join(input.cacheDir, '.git')).then(
      (entry) => entry.isDirectory(),
      () => false,
    );

    if (!exists) {
      await rm(input.cacheDir, { recursive: true, force: true });
      await mkdir(path.dirname(input.cacheDir), { recursive: true });
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', '--branch', input.gitRef, input.remoteUrl, input.cacheDir],
        { env },
      );
    } else {
      await execFileAsync(
        'git',
        ['-C', input.cacheDir, 'fetch', '--depth', '1', 'origin', input.gitRef],
        {
          env,
        },
      );
      await execFileAsync('git', ['-C', input.cacheDir, 'checkout', 'FETCH_HEAD'], { env });
    }

    const { stdout } = await execFileAsync('git', ['-C', input.cacheDir, 'rev-parse', 'HEAD'], {
      env,
    });
    return stdout.trim();
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

  async #requireGitCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (syncSettings.importKind !== 'git') {
      throw ApiError.validation('Corpus importKind must be "git" for git sync.');
    }
    return corpus;
  }
}
