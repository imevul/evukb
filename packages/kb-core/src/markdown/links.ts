import type { ExtractedLinkDraft } from './types.js';

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const wikilinkPattern = /!?\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;
const autolinkPattern = /<(https?:\/\/[^>\s]+)>/g;
const bareUrlPattern = /(?<![("'[])(https?:\/\/[^\s<>)]+)/g;

function normalizeTargetPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return null;
  }
  return trimmed.replace(/^\.\//, '').replace(/^\//, '');
}

export function extractLinks(source: string): ExtractedLinkDraft[] {
  const links: ExtractedLinkDraft[] = [];
  const seen = new Set<string>();

  for (const match of source.matchAll(markdownLinkPattern)) {
    const raw = match[0] ?? '';
    const target = match[1] ?? '';
    if (target.startsWith('http://') || target.startsWith('https://')) {
      addLink(links, seen, {
        linkKind: 'markdown',
        raw,
        targetPath: null,
        externalUrl: target,
      });
      continue;
    }
    addLink(links, seen, {
      linkKind: 'markdown',
      raw,
      targetPath: normalizeTargetPath(target),
      externalUrl: null,
    });
  }

  for (const match of source.matchAll(wikilinkPattern)) {
    const raw = match[0] ?? '';
    const target = match[1]?.trim() ?? '';
    addLink(links, seen, {
      linkKind: 'wikilink',
      raw,
      targetPath: normalizeTargetPath(target),
      externalUrl: null,
    });
  }

  for (const match of source.matchAll(autolinkPattern)) {
    const raw = match[0] ?? '';
    const url = match[1] ?? '';
    addLink(links, seen, {
      linkKind: 'autolink',
      raw,
      targetPath: null,
      externalUrl: url,
    });
  }

  for (const match of source.matchAll(bareUrlPattern)) {
    const url = match[0] ?? '';
    if (seen.has(url)) {
      continue;
    }
    addLink(links, seen, {
      linkKind: 'external',
      raw: url,
      targetPath: null,
      externalUrl: url,
    });
  }

  return links;
}

function addLink(links: ExtractedLinkDraft[], seen: Set<string>, draft: ExtractedLinkDraft): void {
  const key = `${draft.linkKind}:${draft.raw}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  links.push(draft);
}
