import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { splitMarkdownFrontmatter } from './file-manager/frontmatter-sync.js';

marked.setOptions({
  breaks: true,
  gfm: true,
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderFrontmatterBlock(fields: Record<string, string>): string {
  const rows = Object.entries(fields)
    .map(
      ([key, value]) =>
        `<div class="evukb-md-frontmatter__row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join('');
  return `<section class="evukb-md-frontmatter" aria-label="Frontmatter"><dl>${rows}</dl></section>`;
}

/** Obsidian-style callouts: `> [!note] Optional title` followed by `>` lines. */
function preprocessCallouts(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const match = /^>\s*\[!([a-zA-Z0-9-]+)\]\s*(.*)?$/.exec(line);
    if (!match) {
      output.push(line);
      index += 1;
      continue;
    }

    const type = match[1]?.toLowerCase() ?? 'note';
    const title = match[2]?.trim() || type;
    const bodyLines: string[] = [];
    index += 1;
    while (index < lines.length && (lines[index]?.startsWith('>') ?? false)) {
      bodyLines.push((lines[index] ?? '').replace(/^>\s?/, ''));
      index += 1;
    }

    const inner = marked.parse(bodyLines.join('\n')) as string;
    output.push(
      `<aside class="evukb-callout evukb-callout--${escapeHtml(type)}">` +
        `<p class="evukb-callout__title">${escapeHtml(title)}</p>` +
        `<div class="evukb-callout__body">${inner}</div>` +
        `</aside>`,
    );
  }

  return output.join('\n');
}

function preprocessObsidianExtensions(body: string): string {
  let result = body;

  // Obsidian comments — omit from preview.
  result = result.replace(/%%[\s\S]*?%%/g, '');

  // Highlights ==text==
  result = result.replace(/==([^=\n]+?)==/g, '<mark>$1</mark>');

  // Embeds ![[target|alias]]
  result = result.replace(/!\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_raw, target, alias) => {
    const targetPath = String(target).trim();
    const label = alias?.trim() || targetPath;
    return (
      `<div class="evukb-md-embed" data-target="${escapeHtml(targetPath)}">` +
      `<span class="evukb-md-embed__label">${escapeHtml(label)}</span>` +
      `</div>`
    );
  });

  // Wikilinks [[target|alias]] (not embeds)
  result = result.replace(/(?<!!)\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_raw, target, alias) => {
    const targetPath = String(target).trim();
    const label = alias?.trim() || targetPath;
    return `<span class="evukb-wikilink" data-target="${escapeHtml(targetPath)}">${escapeHtml(label)}</span>`;
  });

  // Tags #tag/nested (skip inside fenced code via a cheap guard: line-based pass later if needed)
  result = result.replace(/(?<![\w`])#([a-zA-Z][\w/-]*)/g, '<span class="evukb-tag">#$1</span>');

  return preprocessCallouts(result);
}

/** Sanitize rendered markdown HTML before injecting into the DOM. */
export function sanitizeMarkdownPreviewHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ADD_ATTR: ['data-target'],
    ADD_TAGS: ['mark'],
  });
}

/** Render markdown with common Obsidian extensions into sanitized HTML. */
export function renderObsidianMarkdown(source: string): string {
  const { fields, body, hasFrontmatter } = splitMarkdownFrontmatter(source);
  const preprocessed = preprocessObsidianExtensions(body);
  const bodyHtml = sanitizeMarkdownPreviewHtml(marked.parse(preprocessed) as string);

  if (!hasFrontmatter || Object.keys(fields).length === 0) {
    return bodyHtml;
  }

  return `${renderFrontmatterBlock(fields)}${bodyHtml}`;
}

/** @deprecated Preview tab is available in the markdown file editor. */
export function shouldRenderMarkdownAsPlainText(): boolean {
  return false;
}
