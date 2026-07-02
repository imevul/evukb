import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { CorpusStatsService } from '../src/services/corpus-stats-service.js';

describe('CorpusStatsService', () => {
  it('builds stats and warnings from corpus, node, and link aggregates', async () => {
    const service = new CorpusStatsService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: {},
          fileCount: 2,
          chunkCount: 5,
          totalBytes: 1024,
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            nodeType: 'file',
            name: 'indexed.md',
            mimeType: 'text/markdown',
            indexStatus: 'indexed',
          },
          {
            nodeType: 'file',
            name: 'failed.md',
            mimeType: 'text/markdown',
            indexStatus: 'failed',
          },
          {
            nodeType: 'file',
            name: 'notes.txt',
            mimeType: 'text/plain',
            indexStatus: 'pending',
          },
        ]),
      } as never,
      links: {
        countByResolution: vi.fn().mockResolvedValue({
          total: 3,
          internal: 2,
          resolved: 1,
          unresolved: 1,
        }),
      } as never,
    });

    const stats = await service.getCorpusStats('ws-1', 'corpus-1');
    expect(stats.fileCount).toBe(2);
    expect(stats.indexStatusCounts.indexed).toBe(1);
    expect(stats.indexStatusCounts.failed).toBe(1);
    expect(stats.linkCounts.unresolved).toBe(1);
    expect(stats.okfIssueCount).toBe(0);
    expect(stats.citationIssueCount).toBe(0);
    expect(stats.pendingJobCount).toBe(0);
    expect(stats.failedJobCount).toBe(0);
    expect(stats.warnings).toEqual(
      expect.arrayContaining([
        '1 markdown file failed indexing.',
        '1 internal link remains unresolved.',
      ]),
    );
  });

  it('counts OKF validation issues for OKF corpora', async () => {
    const service = new CorpusStatsService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: { formatProfile: 'okf' },
          fileCount: 1,
          chunkCount: 1,
          totalBytes: 128,
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            nodeType: 'file',
            name: 'concept.md',
            mimeType: 'text/markdown',
            indexStatus: 'indexed',
            metadata: {
              okfConformant: false,
              validationIssues: [
                { code: 'okf.missing_type', severity: 'warning', message: 'missing type' },
              ],
            },
          },
        ]),
      } as never,
      links: {
        countByResolution: vi.fn().mockResolvedValue({
          total: 0,
          internal: 0,
          resolved: 0,
          unresolved: 0,
        }),
      } as never,
    });

    const stats = await service.getCorpusStats('ws-1', 'corpus-1');
    expect(stats.okfIssueCount).toBe(1);
    expect(stats.warnings).toContain('1 OKF markdown file has validation issues.');
  });

  it('warns when import_writeback managed files differ from mount mirror', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-stats-drift-'));
    const kbHash = createHash('sha256').update('# kb version\n', 'utf8').digest('hex');
    const targetPath = path.join(mountRoot, 'docs/note.md');
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, '# mount version\n', 'utf8');

    const service = new CorpusStatsService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
          fileCount: 1,
          chunkCount: 1,
          totalBytes: 128,
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            nodeType: 'file',
            name: 'note.md',
            path: 'docs',
            mimeType: 'text/markdown',
            indexStatus: 'indexed',
            sourceType: 'managed',
            contentHash: kbHash,
          },
        ]),
      } as never,
      links: {
        countByResolution: vi.fn().mockResolvedValue({
          total: 0,
          internal: 0,
          resolved: 0,
          unresolved: 0,
        }),
      } as never,
      mountAllowlist: [mountRoot],
    });

    const stats = await service.getCorpusStats('ws-1', 'corpus-1');
    expect(stats.warnings.some((warning) => warning.includes('differ from mount mirror'))).toBe(
      true,
    );
  });

  it('does not warn when import_writeback mount mirror matches KB hash', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-stats-aligned-'));
    const content = '# aligned\n';
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    const targetPath = path.join(mountRoot, 'note.md');
    await writeFile(targetPath, content, 'utf8');

    const service = new CorpusStatsService({
      corpora: {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
          fileCount: 1,
          chunkCount: 1,
          totalBytes: 128,
        }),
      } as never,
      nodes: {
        listByCorpus: vi.fn().mockResolvedValue([
          {
            nodeType: 'file',
            name: 'note.md',
            path: '',
            mimeType: 'text/markdown',
            indexStatus: 'indexed',
            sourceType: 'managed',
            contentHash: hash,
          },
        ]),
      } as never,
      links: {
        countByResolution: vi.fn().mockResolvedValue({
          total: 0,
          internal: 0,
          resolved: 0,
          unresolved: 0,
        }),
      } as never,
      mountAllowlist: [mountRoot],
    });

    const stats = await service.getCorpusStats('ws-1', 'corpus-1');
    expect(stats.warnings.some((warning) => warning.includes('differ from mount mirror'))).toBe(
      false,
    );
  });
});
