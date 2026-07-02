import type { Citation } from '../../src/citation.js';
import { asChunkId, asCorpusId, asNodeId, asWorkspaceId } from '../../src/ids.js';
import type { SearchResult } from '../../src/search/types.js';

export type CitationSectionGoldenCase = {
  id: string;
  body: string;
  expectedSection: string | null;
};

export type CitationUrlsGoldenCase = {
  id: string;
  section: string;
  expectedUrls: string[];
};

export type CitationBodyUrlsGoldenCase = {
  id: string;
  body: string;
  expectedUrls: string[];
};

export type CitationPolicyGoldenCase = {
  id: string;
  url: string;
  expectedAllowed: boolean;
};

export type DeriveAskCitationsGoldenCase = {
  id: string;
  chunks: SearchResult[];
  expectedCitations: Citation[];
};

export const citationSectionGoldenCases: CitationSectionGoldenCase[] = [
  {
    id: 'section-stops-at-next-heading',
    body: [
      '# Concept',
      '',
      'Body text.',
      '',
      '## Citations',
      '',
      '- [Example](https://example.com/doc)',
      '',
      '## See also',
      '',
      '- [[other]]',
    ].join('\n'),
    expectedSection: '- [Example](https://example.com/doc)',
  },
  {
    id: 'no-citations-heading',
    body: '# Title\n\nNo citations here.',
    expectedSection: null,
  },
];

export const citationUrlsGoldenCases: CitationUrlsGoldenCase[] = [
  {
    id: 'markdown-autolink-bare-urls',
    section: [
      '- [Doc](https://example.com/doc)',
      '- <https://example.org/page>',
      'See https://example.net/reference',
    ].join('\n'),
    expectedUrls: [
      'https://example.com/doc',
      'https://example.org/page',
      'https://example.net/reference',
    ],
  },
];

export const citationBodyUrlsGoldenCases: CitationBodyUrlsGoldenCase[] = [
  {
    id: 'urls-only-from-citations-section',
    body: [
      '# Concept',
      '',
      'Reference https://ignored.example/not-in-section',
      '',
      '## Citations',
      '',
      '- [Allowed](https://allowed.example/ok)',
    ].join('\n'),
    expectedUrls: ['https://allowed.example/ok'],
  },
];

export const citationPolicyGoldenCases: CitationPolicyGoldenCase[] = [
  { id: 'public-https-allowed', url: 'https://example.com/doc', expectedAllowed: true },
  { id: 'localhost-blocked', url: 'http://localhost/admin', expectedAllowed: false },
  { id: 'private-ip-blocked', url: 'http://192.168.1.10/internal', expectedAllowed: false },
  { id: 'file-scheme-blocked', url: 'file:///etc/passwd', expectedAllowed: false },
  { id: 'invalid-url-blocked', url: 'not-a-url', expectedAllowed: false },
];

const sampleCitation: Citation = {
  citationId: asChunkId('chunk-1'),
  corpusId: asCorpusId('corpus-1'),
  nodeId: asNodeId('node-1'),
  chunkId: asChunkId('chunk-1'),
  filePath: 'docs/guide.md',
  headingPath: ['Intro'],
  sourceType: 'chunk',
};

const secondCitation: Citation = {
  citationId: asChunkId('chunk-2'),
  corpusId: asCorpusId('corpus-1'),
  nodeId: asNodeId('node-2'),
  chunkId: asChunkId('chunk-2'),
  filePath: 'docs/other.md',
  headingPath: ['Overview'],
  sourceType: 'chunk',
};

function searchResultFromCitation(citation: Citation, score: number): SearchResult {
  return {
    chunkId: citation.chunkId ?? asChunkId('chunk-unknown'),
    nodeId: citation.nodeId,
    corpusId: citation.corpusId,
    workspaceId: asWorkspaceId('workspace-1'),
    filePath: citation.filePath,
    headingPath: citation.headingPath ?? [],
    bodyPreview: 'fixture content',
    score,
    matchKind: 'keyword',
    citation,
    ranking: {
      strategyId: 'hybrid_default_v1',
      strategyVersion: '1',
      componentScores: { keyword: score },
    },
  };
}

export const deriveAskCitationsGoldenCases: DeriveAskCitationsGoldenCase[] = [
  {
    id: 'single-chunk-citation',
    chunks: [searchResultFromCitation(sampleCitation, 0.42)],
    expectedCitations: [sampleCitation],
  },
  {
    id: 'multiple-chunks-preserve-order',
    chunks: [
      searchResultFromCitation(sampleCitation, 0.9),
      searchResultFromCitation(secondCitation, 0.5),
    ],
    expectedCitations: [sampleCitation, secondCitation],
  },
];
