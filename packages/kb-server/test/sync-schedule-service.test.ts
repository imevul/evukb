import { describe, expect, it, vi } from 'vitest';

import { SyncScheduleService } from '../src/services/sync-schedule-service.js';

describe('SyncScheduleService', () => {
  it('enqueues due mount and git sync jobs', async () => {
    const mountEnqueue = vi.fn().mockResolvedValue('mount-job');
    const gitEnqueue = vi.fn().mockResolvedValue('git-job');
    const service = new SyncScheduleService({
      corpora: {
        listSyncEnabled: vi.fn().mockResolvedValue([
          {
            id: 'mount-corpus',
            workspaceId: 'ws-1',
            settings: {
              importKind: 'mount',
              mountPath: '/data/vault',
              syncIntervalMinutes: 30,
              syncStatus: { lastSyncAt: '2026-06-30T00:00:00.000Z', lastSyncStatus: 'success' },
            },
          },
          {
            id: 'git-corpus',
            workspaceId: 'ws-1',
            settings: {
              importKind: 'git',
              gitRemoteUrl: 'https://example.com/repo.git',
              syncIntervalMinutes: 30,
            },
          },
          {
            id: 'recent-corpus',
            workspaceId: 'ws-1',
            settings: {
              importKind: 'mount',
              mountPath: '/data/other',
              syncIntervalMinutes: 30,
              syncStatus: { lastSyncAt: '2026-06-30T00:50:00.000Z', lastSyncStatus: 'success' },
            },
          },
        ]),
      } as never,
      mountSync: { enqueueSync: mountEnqueue } as never,
      gitSync: { enqueueSync: gitEnqueue } as never,
    });

    const result = await service.runTick(Date.parse('2026-06-30T01:00:00.000Z'));
    expect(result).toEqual({ scanned: 3, enqueued: 2 });
    expect(mountEnqueue).toHaveBeenCalledWith('ws-1', 'mount-corpus');
    expect(gitEnqueue).toHaveBeenCalledWith('ws-1', 'git-corpus');
  });
});
