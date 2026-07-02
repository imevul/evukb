import { describe, expect, it } from 'vitest';

import {
  buildAskContextBlocks,
  buildAskSystemPrompt,
  buildAskUserPrompt,
  buildAskWarnings,
  deriveAskCitations,
  formatAskContextForPrompt,
} from '../src/ask/index.js';
import { asChunkId, asCorpusId, asNodeId, asWorkspaceId } from '../src/ids.js';
import type { SearchResult } from '../src/search/types.js';

function sampleSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    chunkId: asChunkId('chunk-1'),
    nodeId: asNodeId('node-1'),
    corpusId: asCorpusId('corpus-1'),
    workspaceId: asWorkspaceId('workspace-1'),
    filePath: 'docs/guide.md',
    headingPath: ['Intro'],
    bodyPreview: 'EvuKB ask fixture content.',
    score: 0.42,
    matchKind: 'keyword',
    citation: {
      citationId: asChunkId('chunk-1'),
      corpusId: asCorpusId('corpus-1'),
      nodeId: asNodeId('node-1'),
      chunkId: asChunkId('chunk-1'),
      filePath: 'docs/guide.md',
      headingPath: ['Intro'],
      sourceType: 'chunk',
    },
    ranking: {
      strategyId: 'hybrid_default_v1',
      strategyVersion: '1',
      componentScores: { keyword: 0.42 },
    },
    ...overrides,
  };
}

describe('ask context helpers', () => {
  it('builds numbered context blocks from search hits', () => {
    const blocks = buildAskContextBlocks([sampleSearchResult()]);
    expect(blocks).toEqual([
      {
        index: 1,
        label: 'docs/guide.md — Intro',
        content: 'EvuKB ask fixture content.',
      },
    ]);
    expect(formatAskContextForPrompt(blocks)).toContain('[1] docs/guide.md — Intro');
  });

  it('derives citations directly from search hits', () => {
    const chunk = sampleSearchResult();
    expect(deriveAskCitations([chunk])).toEqual([chunk.citation]);
  });

  it('builds prompts for grounded answers', () => {
    const blocks = buildAskContextBlocks([sampleSearchResult()]);
    expect(buildAskSystemPrompt('concise')).toContain('[n]');
    expect(buildAskUserPrompt('What is EvuKB?', formatAskContextForPrompt(blocks))).toContain(
      'Question: What is EvuKB?',
    );
  });

  it('warns on empty or weak retrieval', () => {
    expect(buildAskWarnings([], 'concise')).toContain(
      'No indexed chunks matched the question; answer may be uncertain.',
    );
    expect(buildAskWarnings([sampleSearchResult({ score: 0.01 })], 'detailed')).toContain(
      'Retrieved evidence scores are weak; verify against source documents.',
    );
    expect(buildAskWarnings([sampleSearchResult()], 'extractive')).toContain(
      'Extractive mode received limited context; answer may be incomplete.',
    );
  });
});
