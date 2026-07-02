import {
  parseCorpusSyncSettings,
  parseMountAllowlist,
  resolveAllowedMountPath,
  resolveSyncedSourceType,
  type SyncImportResult,
} from '@evu/kb-core';
import type { CorpusRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { MountSyncJob } from '../jobs/types.js';
import type { SyncImportService } from './sync-import-service.js';

export type MountSyncServiceDeps = {
  corpora: CorpusRepository;
  jobQueue: JobQueueService;
  syncImport: SyncImportService;
  mountAllowlist?: string;
};

export class MountSyncService {
  readonly #corpora: CorpusRepository;
  readonly #jobQueue: JobQueueService;
  readonly #syncImport: SyncImportService;
  readonly #mountAllowlist: string | undefined;

  constructor(deps: MountSyncServiceDeps) {
    this.#corpora = deps.corpora;
    this.#jobQueue = deps.jobQueue;
    this.#syncImport = deps.syncImport;
    this.#mountAllowlist = deps.mountAllowlist;
  }

  async enqueueSync(workspaceId: string, corpusId: string): Promise<string | null> {
    const corpus = await this.#requireMountCorpus(workspaceId, corpusId);
    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (!syncSettings.mountPath) {
      throw ApiError.validation('Corpus mountPath is not configured.');
    }

    await this.#syncImport.updateSyncStatus(workspaceId, corpusId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'running',
    });

    return this.#jobQueue.enqueueMountSync({ workspaceId, corpusId });
  }

  async runSync(job: MountSyncJob): Promise<SyncImportResult> {
    const corpus = await this.#requireMountCorpus(job.workspaceId, job.corpusId);
    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (!syncSettings.mountPath) {
      throw ApiError.validation('Corpus mountPath is not configured.');
    }

    const allowlist = parseMountAllowlist(
      this.#mountAllowlist ?? process.env.EVUKB_MOUNT_ALLOWLIST,
    );
    const resolved = resolveAllowedMountPath(syncSettings.mountPath, allowlist);
    if ('error' in resolved) {
      throw ApiError.validation(resolved.error);
    }

    try {
      const result = await this.#syncImport.importScannedFiles({
        workspaceId: job.workspaceId,
        corpusId: job.corpusId,
        rootDir: resolved.resolved,
        sourceTypes: ['shared_mount', 'reference'],
        buildSourceRef: (relativePath) => relativePath,
        resolveSourceType: resolveSyncedSourceType,
        ...(syncSettings.mountMode ? { mountMode: syncSettings.mountMode } : {}),
      });

      await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: result.errors.length > 0 ? 'failed' : 'success',
        ...(result.errors.length > 0
          ? { lastSyncError: result.errors.slice(0, 3).join('; ') }
          : {}),
      });

      return result;
    } catch (error) {
      await this.#syncImport.updateSyncStatus(job.workspaceId, job.corpusId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : 'Mount sync failed.',
      });
      throw error;
    }
  }

  async #requireMountCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    if (syncSettings.importKind !== 'mount') {
      throw ApiError.validation('Corpus importKind must be "mount" for mount sync.');
    }
    return corpus;
  }
}
