import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { GitSyncService } from '../services/git-sync-service.js';
import type { MountSyncService } from '../services/mount-sync-service.js';

export type SyncRoutesOptions = {
  mountSync: MountSyncService;
  gitSync: GitSyncService;
};

export const syncRoutesPlugin: FastifyPluginAsync<SyncRoutesOptions> = async (server, options) => {
  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/sync-mount',
    async (request) => {
      const jobId = await options.mountSync.enqueueSync(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      return {
        enqueued: true,
        jobId,
      };
    },
  );

  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/sync-git',
    async (request) => {
      const jobId = await options.gitSync.enqueueSync(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      return {
        enqueued: true,
        jobId,
      };
    },
  );
};

export function assertSyncRoutesAvailable(
  mountSync: MountSyncService | undefined,
  gitSync: GitSyncService | undefined,
): asserts mountSync is MountSyncService {
  if (!mountSync || !gitSync) {
    throw ApiError.serviceUnavailable('Sync services are not available.');
  }
}
