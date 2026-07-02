import { describe, expect, it } from 'vitest';

import {
  chunkMarkdownBody,
  estimateTokenCount,
  extractLinks,
  parseFrontmatter,
  parseMarkdownDocument,
  resolveChunkerVersion,
} from '../src/markdown/index.js';

describe('markdown frontmatter', () => {
  it('parses yaml frontmatter and returns the body', () => {
    const parsed = parseFrontmatter(
      `---\ntitle: Notes\ntags: [one, two]\n---\n# Hello\n\nBody text.\n`,
    );
    expect(parsed.parsed).toMatchObject({ title: 'Notes', tags: ['one', 'two'] });
    expect(parsed.body).toBe('# Hello\n\nBody text.\n');
    expect(parsed.errors).toEqual([]);
  });
});

describe('markdown chunker', () => {
  it('splits on headings and preserves heading paths', () => {
    const chunks = chunkMarkdownBody(
      `Intro paragraph.\n\n## Section A\n\nAlpha.\n\n### Section B\n\nBeta.\n`,
    );
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.headingPath).toEqual([]);
    expect(chunks[1]?.headingPath).toEqual(['Section A']);
    expect(chunks[2]?.headingPath).toEqual(['Section A', 'Section B']);
    expect(chunks[2]?.body).toContain('Beta.');
  });

  it('keeps headingless notes as one chunk in headings mode', () => {
    const yamlBlock = `\`\`\`yaml\n${'key: value\n'.repeat(200)}\`\`\``;
    const chunks = chunkMarkdownBody(yamlBlock, { strategy: 'headings' });
    expect(chunks).toHaveLength(1);
    expect(estimateTokenCount(chunks[0]?.body ?? '')).toBeGreaterThan(512);
  });

  it('splits headingless notes at natural boundaries in subsplit mode', () => {
    const body = ['Paragraph one.', 'Paragraph two.', 'Paragraph three.'].join('\n\n');
    const chunks = chunkMarkdownBody(body, { strategy: 'headings_subsplit' });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('caps oversized sections to max chunk tokens', () => {
    const yamlBlock = `\`\`\`yaml\n${'key: value\n'.repeat(200)}\`\`\``;
    const chunks = chunkMarkdownBody(yamlBlock, {
      strategy: 'headings_subsplit_capped',
      maxChunkTokens: 512,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(512);
    }
  });

  it('splits oversized sections under one heading when capped', () => {
    const body = `# Servers\n\n${'line item\n'.repeat(400)}`;
    const chunks = chunkMarkdownBody(body, {
      strategy: 'headings_subsplit_capped',
      maxChunkTokens: 128,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.headingPath.join('/') === 'Servers')).toBe(true);
  });
});

describe('markdown links', () => {
  it('extracts markdown, wikilink, and autolink targets', () => {
    const links = extractLinks(
      'See [Guide](./guide.md) and [[Other Note]] plus <https://example.com/docs>.\n',
    );
    expect(links.map((link) => link.linkKind)).toEqual(
      expect.arrayContaining(['markdown', 'wikilink', 'autolink']),
    );
    expect(links.find((link) => link.linkKind === 'markdown')?.targetPath).toBe('guide.md');
    expect(links.find((link) => link.linkKind === 'wikilink')?.targetPath).toBe('Other Note');
  });
});

describe('parseMarkdownDocument', () => {
  it('returns parser and chunker versions with parsed output', () => {
    const parsed = parseMarkdownDocument(`---\ntitle: Doc\n---\n# Title\n\n[[Link]]\n`);
    expect(parsed.parserVersion).toBe('generic_v1');
    expect(parsed.chunkerVersion).toBe('heading_v1');
    expect(parsed.chunks.length).toBeGreaterThan(0);
    expect(parsed.links.some((link) => link.linkKind === 'wikilink')).toBe(true);
  });

  it('uses heading_v2 when chunking strategy is not headings', () => {
    const parsed = parseMarkdownDocument('# Title\n\nBody.\n', {
      chunking: { strategy: 'headings_subsplit_capped', maxChunkTokens: 512 },
    });
    expect(parsed.chunkerVersion).toBe('heading_v2');
    expect(resolveChunkerVersion({ strategy: 'headings_subsplit_capped' })).toBe('heading_v2');
  });
});
