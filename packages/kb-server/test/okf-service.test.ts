import { describe, expect, it, vi } from 'vitest';

import { OkfService } from '../src/services/okf-service.js';

describe('OkfService', () => {
  it('reads index.md content for an OKF corpus directory', async () => {
    const service = new OkfService({
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
            path: 'team/',
            storageRelPath: 'team/index.md',
          },
        ]),
      } as never,
      fileManager: {
        readContent: vi.fn().mockResolvedValue({
          content: Buffer.from('# Team\n\nOverview.\n', 'utf8'),
        }),
      } as never,
      indexService: {} as never,
    });

    const result = await service.readIndex('ws-1', 'corpus-1', 'team/');
    expect(result.content).toContain('# Team');
    expect(result.directory).toBe('team/');
    expect(result.nodeId).toBe('index-1');
    expect(result.synthesized).toBe(false);
  });

  it('returns null content when index.md is missing', async () => {
    const service = new OkfService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: { formatProfile: 'okf' },
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([]),
      } as never,
      fileManager: {} as never,
      indexService: {} as never,
    });

    const result = await service.readIndex('ws-1', 'corpus-1');
    expect(result.content).toBeNull();
    expect(result.directory).toBe('');
  });

  it('lists concepts with type and tag filters from indexed metadata', async () => {
    const service = new OkfService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: { formatProfile: 'okf' },
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            id: 'node-1',
            nodeType: 'file',
            name: 'alpha.md',
            path: '',
            indexStatus: 'indexed',
            metadata: {
              frontmatter: { type: 'Document', title: 'Alpha', tags: ['core'] },
            },
          },
          {
            id: 'node-2',
            nodeType: 'file',
            name: 'beta.md',
            path: 'team',
            indexStatus: 'indexed',
            metadata: {
              frontmatter: { type: 'Playbook', title: 'Beta', tags: ['ops'] },
            },
          },
        ]),
      } as never,
      fileManager: {} as never,
      indexService: {} as never,
    });

    const all = await service.listConcepts('ws-1', 'corpus-1');
    expect(all.concepts).toHaveLength(2);

    const filtered = await service.listConcepts('ws-1', 'corpus-1', {
      conceptType: 'Playbook',
      tag: 'ops',
      pathPrefix: 'team',
    });
    expect(filtered.concepts).toEqual([
      expect.objectContaining({
        nodeId: 'node-2',
        conceptId: 'team/beta',
        type: 'Playbook',
        title: 'Beta',
        tags: ['ops'],
      }),
    ]);
  });

  it('rejects export when corpus is not OKF', async () => {
    const service = new OkfService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          name: 'Docs',
          settings: {},
        }),
      } as never,
      nodes: { listByCorpus: vi.fn() } as never,
      fileManager: {} as never,
      indexService: {} as never,
    });

    await expect(service.exportCorpusOkfZip('ws-1', 'corpus-1')).rejects.toMatchObject({
      code: 'validation_error',
    });
  });
});
