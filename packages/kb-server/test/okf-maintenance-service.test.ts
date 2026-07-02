import { OKF_INDEX_AUTO_BEGIN, OKF_INDEX_AUTO_END } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { OkfMaintenanceService } from '../src/services/okf-maintenance-service.js';

describe('OkfMaintenanceService', () => {
  it('updates folder index.md when a concept is created', async () => {
    const saveContentInternal = vi.fn().mockResolvedValue({});
    const readContent = vi.fn().mockImplementation(async (_ws, _corp, nodeId: string) => {
      if (nodeId === 'index-1') {
        return {
          content: Buffer.from(
            ['# Index', '', OKF_INDEX_AUTO_BEGIN, OKF_INDEX_AUTO_END, ''].join('\n'),
            'utf8',
          ),
        };
      }
      return {
        content: Buffer.from('---\ntype: Document\ntitle: Alpha\n---\n\nBody.\n', 'utf8'),
      };
    });

    const service = new OkfMaintenanceService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: { formatProfile: 'okf' },
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            id: 'index-1',
            nodeType: 'file',
            name: 'index.md',
            path: '',
            storageRelPath: 'managed/index-1',
          },
          {
            id: 'concept-1',
            nodeType: 'file',
            name: 'alpha.md',
            path: '',
            storageRelPath: 'managed/concept-1',
          },
        ]),
      } as never,
      fileManager: {
        readContent,
        createFileInternal: vi.fn().mockResolvedValue({ id: 'log-1' }),
        saveContentInternal,
      } as never,
    });

    const result = await service.maintainForEvent('ws-1', 'corpus-1', {
      kind: 'create',
      filePath: 'alpha.md',
      content: '---\ntype: Document\ntitle: Alpha\n---\n\nBody.\n',
    });

    expect(result.indexNodeIds).toEqual(['index-1']);
    expect(saveContentInternal).toHaveBeenCalledWith(
      'ws-1',
      'corpus-1',
      'index-1',
      expect.objectContaining({
        content: expect.any(Buffer),
      }),
    );
    expect(saveContentInternal.mock.calls[0]?.[3].content.toString('utf8')).toContain('alpha.md');
  });

  it('no-ops for generic corpora', async () => {
    const service = new OkfMaintenanceService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {},
        }),
      } as never,
      nodes: { listByCorpus: vi.fn() } as never,
      fileManager: {} as never,
    });

    const result = await service.maintainForEvent('ws-1', 'corpus-1', {
      kind: 'create',
      filePath: 'alpha.md',
    });
    expect(result).toEqual({ indexNodeIds: [], logNodeId: null });
  });
});
