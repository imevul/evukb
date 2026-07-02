import type { FailedJobRecord } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { enrichFailedJobsWithFilePaths } from '../src/jobs/failed-job-enrichment.js';

function createJob(overrides: Partial<FailedJobRecord> = {}): FailedJobRecord {
  return {
    id: 'job-1',
    queueName: 'evu-kb-index',
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    nodeId: 'node-1',
    filePath: null,
    failedAt: '2026-07-02T10:00:00.000Z',
    errorMessage: 'failed',
    output: null,
    payload: {},
    ...overrides,
  };
}

describe('enrichFailedJobsWithFilePaths', () => {
  it('resolves node file paths from the node repository', async () => {
    const nodeRepository = {
      listByIds: vi.fn().mockResolvedValue([
        {
          id: 'node-1',
          path: 'docs',
          name: 'guide.md',
        },
      ]),
    };

    const enriched = await enrichFailedJobsWithFilePaths(nodeRepository as never, 'ws-1', [
      createJob(),
    ]);

    expect(nodeRepository.listByIds).toHaveBeenCalledWith('ws-1', 'corpus-1', ['node-1']);
    expect(enriched[0]?.filePath).toBe('docs/guide.md');
  });

  it('uses folderPath from the payload when present', async () => {
    const nodeRepository = {
      listByIds: vi.fn(),
    };

    const enriched = await enrichFailedJobsWithFilePaths(nodeRepository as never, 'ws-1', [
      createJob({
        payload: { folderPath: 'notes/project' },
      }),
    ]);

    expect(nodeRepository.listByIds).not.toHaveBeenCalled();
    expect(enriched[0]?.filePath).toBe('notes/project');
  });
});
