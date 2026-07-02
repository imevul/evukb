import type { LinkKind } from '../runtime.js';

export type MarkdownParseError = {
  code: string;
  message: string;
};

export type ParsedFrontmatter = {
  raw: string;
  parsed: Record<string, unknown>;
  body: string;
  errors: MarkdownParseError[];
};

export type MarkdownChunkDraft = {
  ordinal: number;
  headingPath: string[];
  body: string;
  bodyPreview: string;
  tokenCount: number;
};

export type ExtractedLinkDraft = {
  linkKind: LinkKind;
  raw: string;
  targetPath: string | null;
  externalUrl: string | null;
};

export type ParsedMarkdownDocument = {
  frontmatter: ParsedFrontmatter;
  chunks: MarkdownChunkDraft[];
  links: ExtractedLinkDraft[];
  parserVersion: string;
  chunkerVersion: string;
};
