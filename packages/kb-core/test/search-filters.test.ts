import { describe, expect, it } from 'vitest';

import type { KnowledgeNode } from '../src/node.js';
import {
  filtersNeedSqlJoin,
  hasKnowledgeFilters,
  nodeMatchesKnowledgeFilters,
  nodeRelativeFilePath,
  parseKnowledgeFilters,
  validateKnowledgeFilters,
} from '../src/search/filters.js';
import { createDefaultRankingStrategyRegistry } from '../src/search/ranking-registry.js';

function sampleNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: 'docs',
    name: 'alpha.md',
    nodeType: 'file',
    storageRelPath: 'docs/alpha.md',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 100,
    indexStatus: 'indexed',
    metadata: {
      frontmatter: { type: 'Playbook', title: 'Alpha', tags: ['ops', 'core'], status: 'active' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as KnowledgeNode;
}

describe('search filters', () => {
  it('parses and validates filter objects', () => {
    expect(parseKnowledgeFilters({ tags: ['ops'], okfType: 'Playbook' })).toEqual({
      tags: ['ops'],
      okfType: 'Playbook',
    });
    expect(
      parseKnowledgeFilters({
        pathAllowlist: ['docs/'],
        frontmatter: { status: 'active' },
        sourceTypes: ['managed'],
        indexStatus: ['indexed'],
      }),
    ).toEqual({
      pathAllowlist: ['docs'],
      frontmatter: { status: 'active' },
      sourceTypes: ['managed'],
      indexStatus: ['indexed'],
    });
    expect(validateKnowledgeFilters({ tags: ['ops'] })).toBeNull();
    expect(validateKnowledgeFilters({ tags: 'bad' })).toContain('array');
    expect(validateKnowledgeFilters({ okfType: 1 })).toContain('string');
    expect(validateKnowledgeFilters({ sourceTypes: ['invalid'] })).toContain('source types');
  });

  it('matches tags with any-tag semantics', () => {
    const node = sampleNode();
    expect(nodeMatchesKnowledgeFilters(node, { tags: ['ops'] })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { tags: ['missing'] })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { tags: ['OPS'] })).toBe(true);
  });

  it('matches okf type and file types', () => {
    const node = sampleNode();
    expect(nodeMatchesKnowledgeFilters(node, { okfType: 'playbook' })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { okfType: 'Document' })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { fileTypes: ['markdown'] })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { fileTypes: ['pdf'] })).toBe(false);
  });

  it('matches path allowlist, frontmatter, source type, and index status', () => {
    const node = sampleNode();
    expect(nodeRelativeFilePath(node)).toBe('docs/alpha.md');
    expect(nodeMatchesKnowledgeFilters(node, { pathAllowlist: ['docs'] })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { pathAllowlist: ['guides'] })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { frontmatter: { status: 'active' } })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { frontmatter: { status: 'draft' } })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { frontmatter: { title: 'New*' } })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { frontmatter: { title: 'Al*' } })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { frontmatter: { title: 'Alph?' } })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { sourceTypes: ['managed'] })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { sourceTypes: ['git'] })).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, { indexStatus: ['indexed'] })).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, { indexStatus: ['pending'] })).toBe(false);
  });

  it('treats empty filters as pass-through', () => {
    const node = sampleNode();
    expect(hasKnowledgeFilters(undefined)).toBe(false);
    expect(nodeMatchesKnowledgeFilters(node, undefined)).toBe(true);
    expect(nodeMatchesKnowledgeFilters(node, {})).toBe(true);
  });

  it('detects SQL-joinable filters', () => {
    expect(filtersNeedSqlJoin({ tags: ['ops'] })).toBe(true);
    expect(filtersNeedSqlJoin({ fileTypes: ['markdown'] })).toBe(false);
  });
});

describe('ranking strategy registry', () => {
  it('resolves active strategies and rejects unknown strategies', () => {
    const registry = createDefaultRankingStrategyRegistry();
    expect(registry.resolve('hybrid_default_v1').id).toBe('hybrid_default_v1');
    expect(registry.resolve('semantic_only').id).toBe('semantic_only');
    expect(registry.resolve('keyword_only').id).toBe('keyword_only');
    expect(registry.resolve('reranker_llm').postRank).toBe('llm');
    expect(() => registry.resolve('unknown_strategy')).toThrow('Unknown ranking strategy');
  });
});
