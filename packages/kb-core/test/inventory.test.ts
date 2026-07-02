import { describe, expect, it } from 'vitest';

import {
  allowsMetadataOnlySearch,
  buildDocumentInventoryRows,
  matchesDocumentPathPrefix,
} from '../src/inventory/index.js';
import type { KnowledgeNode } from '../src/node.js';

function sampleNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: 'Areas/Servers',
    name: 'nuc.md',
    nodeType: 'file',
    storageRelPath: 'managed/node-1',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 100,
    indexStatus: 'indexed',
    metadata: {
      frontmatter: {
        type: 'server',
        hostname: 'nuc',
        os: 'Ubuntu 24.04.4 LTS',
        virtual: false,
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('document inventory', () => {
  it('matches path prefixes', () => {
    expect(matchesDocumentPathPrefix('Areas/Servers/nuc.md', 'Areas/Servers')).toBe(true);
    expect(matchesDocumentPathPrefix('Areas/VPS/x.md', 'Areas/Servers')).toBe(false);
  });

  it('filters and projects frontmatter fields', () => {
    const rows = buildDocumentInventoryRows([sampleNode()], {
      pathPrefix: 'Areas/Servers',
      filters: { frontmatter: { type: 'server' } },
      fields: ['hostname', 'os'],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.frontmatter).toEqual({
      hostname: 'nuc',
      os: 'Ubuntu 24.04.4 LTS',
    });
  });
});

describe('metadata-only search scope', () => {
  it('allows empty query with filters or pathPrefix', () => {
    expect(
      allowsMetadataOnlySearch({ query: '', filters: { frontmatter: { type: 'server' } } }),
    ).toBe(true);
    expect(allowsMetadataOnlySearch({ query: '   ', pathPrefix: 'Servers' })).toBe(true);
    expect(allowsMetadataOnlySearch({ query: '' })).toBe(false);
    expect(allowsMetadataOnlySearch({ query: 'ubuntu' })).toBe(false);
  });
});
