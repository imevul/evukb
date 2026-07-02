import type { KnowledgeNode } from '../../src/node.js';

export type LinksGoldenNode = Pick<KnowledgeNode, 'id' | 'path' | 'name' | 'nodeType' | 'mimeType'>;

export type LinksResolveGoldenCase = {
  id: string;
  nodes: LinksGoldenNode[];
  link: { targetPath: string | null; externalUrl: string | null };
  expected: { toNodeId: string | null; resolved: boolean };
};

export type LinksCandidatesGoldenCase = {
  id: string;
  filePath: string;
  expected: string[];
};

export type LinksInternalGoldenCase = {
  id: string;
  externalUrl: string | null;
  expectedInternal: boolean;
};

const baseNode: LinksGoldenNode = {
  id: 'node-target',
  path: '',
  name: 'target.md',
  nodeType: 'file',
  mimeType: 'text/markdown',
};

export const linksResolveGoldenCases: LinksResolveGoldenCase[] = [
  {
    id: 'wikilink-without-md-suffix',
    nodes: [baseNode],
    link: { targetPath: 'target', externalUrl: null },
    expected: { toNodeId: 'node-target', resolved: true },
  },
  {
    id: 'wikilink-with-md-suffix',
    nodes: [baseNode],
    link: { targetPath: 'target.md', externalUrl: null },
    expected: { toNodeId: 'node-target', resolved: true },
  },
  {
    id: 'nested-path-resolution',
    nodes: [
      baseNode,
      {
        id: 'node-nested',
        path: 'guides',
        name: 'intro.md',
        nodeType: 'file',
        mimeType: 'text/markdown',
      },
    ],
    link: { targetPath: 'guides/intro', externalUrl: null },
    expected: { toNodeId: 'node-nested', resolved: true },
  },
  {
    id: 'external-link-unresolved',
    nodes: [baseNode],
    link: { targetPath: null, externalUrl: 'https://example.com' },
    expected: { toNodeId: null, resolved: false },
  },
  {
    id: 'missing-target-unresolved',
    nodes: [baseNode],
    link: { targetPath: 'missing', externalUrl: null },
    expected: { toNodeId: null, resolved: false },
  },
];

export const linksCandidatesGoldenCases: LinksCandidatesGoldenCase[] = [
  {
    id: 'path-with-md-suffix',
    filePath: 'notes/target.md',
    expected: ['notes/target.md', 'notes/target'],
  },
  {
    id: 'path-without-md-suffix',
    filePath: 'notes/target',
    expected: ['notes/target', 'notes/target.md'],
  },
];

export const linksInternalGoldenCases: LinksInternalGoldenCase[] = [
  { id: 'internal-null-external', externalUrl: null, expectedInternal: true },
  { id: 'external-https', externalUrl: 'https://example.com', expectedInternal: false },
];
