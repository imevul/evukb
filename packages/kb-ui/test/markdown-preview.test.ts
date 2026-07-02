// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { renderObsidianMarkdown, sanitizeMarkdownPreviewHtml } from '../src/markdown-preview.js';

describe('renderObsidianMarkdown', () => {
  it('renders headings and body text', () => {
    const html = renderObsidianMarkdown('# Title\n\nParagraph.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Paragraph.</p>');
  });

  it('renders frontmatter as a metadata block', () => {
    const html = renderObsidianMarkdown('---\ntitle: Example\n---\n\nBody.');
    expect(html).toContain('evukb-md-frontmatter');
    expect(html).toContain('Example');
    expect(html).toContain('<p>Body.</p>');
  });

  it('supports wikilinks, highlights, tags, and embeds', () => {
    const html = renderObsidianMarkdown(
      'See [[Other Note|alias]] and #servers\n\n==highlight==\n\n![[Embedded Page]]',
    );
    expect(html).toContain('class="evukb-wikilink"');
    expect(html).toContain('alias');
    expect(html).toContain('<mark>highlight</mark>');
    expect(html).toContain('class="evukb-tag"');
    expect(html).toContain('evukb-md-embed');
    expect(html).toContain('Embedded Page');
  });

  it('supports Obsidian callouts', () => {
    const html = renderObsidianMarkdown('> [!note] DHCP\n> Router hands out leases.');
    expect(html).toContain('evukb-callout--note');
    expect(html).toContain('DHCP');
    expect(html).toContain('Router hands out leases.');
  });
});

describe('sanitizeMarkdownPreviewHtml', () => {
  it('strips script tags and inline event handlers', () => {
    const input = '<p>Hello</p><script>alert(1)</script><img onerror="alert(2)" src="x">';
    expect(sanitizeMarkdownPreviewHtml(input)).not.toContain('<script');
    expect(sanitizeMarkdownPreviewHtml(input)).not.toMatch(/onerror=/i);
    expect(sanitizeMarkdownPreviewHtml(input)).toContain('<p>Hello</p>');
  });
});
