import { type ChunkMarkdownOptions, chunkMarkdownBody, resolveChunkerVersion } from './chunker.js';
import { parseFrontmatter } from './frontmatter.js';
import { extractLinks } from './links.js';
import type { ParsedMarkdownDocument } from './types.js';
import { markdownParserVersion } from './versions.js';

export * from './chunker.js';
export * from './frontmatter.js';
export * from './frontmatter-summary.js';
export * from './links.js';
export * from './types.js';
export * from './versions.js';

export type ParseMarkdownDocumentOptions = {
  chunking?: ChunkMarkdownOptions;
};

export function parseMarkdownDocument(
  source: string,
  options: ParseMarkdownDocumentOptions = {},
): ParsedMarkdownDocument {
  const frontmatter = parseFrontmatter(source);
  const chunking = options.chunking ?? {};
  const chunks = chunkMarkdownBody(frontmatter.body, chunking);
  const links = extractLinks(frontmatter.body);
  return {
    frontmatter,
    chunks,
    links,
    parserVersion: markdownParserVersion,
    chunkerVersion: resolveChunkerVersion(chunking),
  };
}
