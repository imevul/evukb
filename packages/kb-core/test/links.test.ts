import { describe, expect, it } from 'vitest';

import {
  buildMarkdownPathToNodeIdMap,
  isInternalLink,
  resolveInternalLinkTarget,
  targetPathCandidates,
} from '../src/links/resolve.js';
import type { KnowledgeNode } from '../src/node.js';

function createNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-target',
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: '',
    name: 'target.md',
    nodeType: 'file',
    storageRelPath: 'managed/target',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 12,
    indexStatus: 'indexed',
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('link resolution', () => {
  it('builds markdown path map and resolves wikilink targets with or without .md', () => {
    const pathMap = buildMarkdownPathToNodeIdMap([
      createNode(),
      createNode({
        id: 'node-nested',
        path: 'guides',
        name: 'intro.md',
      }),
    ]);

    expect(pathMap.get('target.md')).toBe('node-target');
    expect(pathMap.get('guides/intro.md')).toBe('node-nested');

    expect(resolveInternalLinkTarget({ targetPath: 'target', externalUrl: null }, pathMap)).toEqual(
      {
        toNodeId: 'node-target',
        resolved: true,
      },
    );
    expect(
      resolveInternalLinkTarget({ targetPath: 'target.md', externalUrl: null }, pathMap),
    ).toEqual({
      toNodeId: 'node-target',
      resolved: true,
    });
    expect(
      resolveInternalLinkTarget({ targetPath: 'guides/intro', externalUrl: null }, pathMap),
    ).toEqual({
      toNodeId: 'node-nested',
      resolved: true,
    });
  });

  it('leaves external links unresolved and missing targets unresolved', () => {
    const pathMap = buildMarkdownPathToNodeIdMap([createNode()]);

    expect(
      resolveInternalLinkTarget({ targetPath: null, externalUrl: 'https://example.com' }, pathMap),
    ).toEqual({
      toNodeId: null,
      resolved: false,
    });
    expect(
      resolveInternalLinkTarget({ targetPath: 'missing', externalUrl: null }, pathMap),
    ).toEqual({
      toNodeId: null,
      resolved: false,
    });
    expect(isInternalLink({ externalUrl: null })).toBe(true);
    expect(isInternalLink({ externalUrl: 'https://example.com' })).toBe(false);
  });

  it('generates target path candidates for incoming link patches', () => {
    expect(targetPathCandidates('notes/target.md')).toEqual(['notes/target.md', 'notes/target']);
    expect(targetPathCandidates('notes/target')).toEqual(['notes/target', 'notes/target.md']);
  });
});
