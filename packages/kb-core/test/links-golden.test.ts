import { describe, expect, it } from 'vitest';

import {
  buildMarkdownPathToNodeIdMap,
  isInternalLink,
  resolveInternalLinkTarget,
  targetPathCandidates,
} from '../src/links/resolve.js';
import type { KnowledgeNode } from '../src/node.js';
import {
  type LinksGoldenNode,
  linksCandidatesGoldenCases,
  linksInternalGoldenCases,
  linksResolveGoldenCases,
} from './fixtures/links-golden.js';

function toKnowledgeNode(node: LinksGoldenNode): KnowledgeNode {
  return {
    id: node.id,
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: node.path,
    name: node.name,
    nodeType: node.nodeType,
    storageRelPath: `managed/${node.name}`,
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: node.mimeType,
    sizeBytes: 12,
    indexStatus: 'indexed',
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('links golden fixtures', () => {
  for (const goldenCase of linksResolveGoldenCases) {
    it(`resolves ${goldenCase.id}`, () => {
      const pathMap = buildMarkdownPathToNodeIdMap(goldenCase.nodes.map(toKnowledgeNode));
      expect(resolveInternalLinkTarget(goldenCase.link, pathMap)).toEqual(goldenCase.expected);
    });
  }

  for (const goldenCase of linksCandidatesGoldenCases) {
    it(`generates path candidates for ${goldenCase.id}`, () => {
      expect(targetPathCandidates(goldenCase.filePath)).toEqual(goldenCase.expected);
    });
  }

  for (const goldenCase of linksInternalGoldenCases) {
    it(`classifies internal/external for ${goldenCase.id}`, () => {
      expect(isInternalLink({ externalUrl: goldenCase.externalUrl })).toBe(
        goldenCase.expectedInternal,
      );
    });
  }
});
