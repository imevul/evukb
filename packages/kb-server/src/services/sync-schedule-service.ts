import { isSyncDue, resolveImportKind } from '@evu/kb-core';
import type { CorpusRepository } from '@evu/kb-db';

import type { GitSyncService } from './git-sync-service.js';
import type { MountSyncService } from './mount-sync-service.js';

export type SyncScheduleServiceDeps = {
  corpora: CorpusRepository;
  mountSync: MountSyncService;
  gitSync: GitSyncService;
};

export class SyncScheduleService {
  readonly #corpora: CorpusRepository;
  readonly #mountSync: MountSyncService;
  readonly #gitSync: GitSyncService;

  constructor(deps: SyncScheduleServiceDeps) {
    this.#corpora = deps.corpora;
    this.#mountSync = deps.mountSync;
    this.#gitSync = deps.gitSync;
  }

  async runTick(nowMs: number = Date.now()): Promise<{ scanned: number; enqueued: number }> {
    const corpora = await this.#corpora.listSyncEnabled();
    let enqueued = 0;

    for (const corpus of corpora) {
      if (!isSyncDue(corpus.settings, nowMs)) {
        continue;
      }

      const importKind = resolveImportKind(corpus.settings);
      try {
        if (importKind === 'mount') {
          const jobId = await this.#mountSync.enqueueSync(corpus.workspaceId, corpus.id);
          if (jobId) {
            enqueued += 1;
          }
        } else if (importKind === 'git') {
          const jobId = await this.#gitSync.enqueueSync(corpus.workspaceId, corpus.id);
          if (jobId) {
            enqueued += 1;
          }
        }
      } catch {
        // Skip corpora with invalid sync configuration during scheduled ticks.
      }
    }

    return { scanned: corpora.length, enqueued };
  }
}
