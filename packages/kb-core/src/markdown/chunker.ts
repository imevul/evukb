import type { EmbeddingChunkingStrategy } from '../settings/chunking.js';
import type { MarkdownChunkDraft } from './types.js';
import { markdownChunkerVersion, markdownChunkerVersionV2 } from './versions.js';

const headingPattern = /^(#{1,6})\s+(.+?)\s*$/;
const fencedBlockPattern = /(```[\s\S]*?```)/g;

export type ChunkMarkdownOptions = {
  strategy?: EmbeddingChunkingStrategy;
  maxChunkTokens?: number;
};

type Section = {
  headingPath: string[];
  lines: string[];
};

export function estimateTokenCount(text: string): number {
  return text.trim().length === 0 ? 0 : Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

function makePreview(body: string, maxLength = 240): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitNaturalParts(text: string): string[] {
  const parts = text
    .split(fencedBlockPattern)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return splitByParagraphs(text);
  }

  const expanded: string[] = [];
  for (const part of parts) {
    if (part.startsWith('```') && part.endsWith('```')) {
      expanded.push(part);
      continue;
    }
    const paragraphs = splitByParagraphs(part);
    expanded.push(...(paragraphs.length > 0 ? paragraphs : [part]));
  }
  return expanded;
}

function splitByLines(text: string, maxTokens: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const candidate = [...current, line].join('\n').trim();
    if (current.length > 0 && estimateTokenCount(candidate) > maxTokens) {
      chunks.push(current.join('\n').trim());
      current = [line];
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    chunks.push(current.join('\n').trim());
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function splitByCharacters(text: string, maxTokens: number): string[] {
  const maxChars = Math.max(256, Math.floor(maxTokens * 3));
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += maxChars) {
    chunks.push(text.slice(offset, offset + maxChars).trim());
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function capSplitText(text: string, maxTokens: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (estimateTokenCount(trimmed) <= maxTokens) {
    return [trimmed];
  }

  const paragraphs = splitByParagraphs(trimmed);
  if (paragraphs.length > 1) {
    return paragraphs.flatMap((paragraph) => capSplitText(paragraph, maxTokens));
  }

  const naturalParts = splitNaturalParts(trimmed);
  if (naturalParts.length > 1) {
    return naturalParts.flatMap((part) => capSplitText(part, maxTokens));
  }

  const lineChunks = splitByLines(trimmed, maxTokens);
  if (lineChunks.length > 1) {
    return lineChunks.flatMap((chunk) =>
      estimateTokenCount(chunk) > maxTokens ? capSplitText(chunk, maxTokens) : [chunk],
    );
  }

  const charChunks = splitByCharacters(trimmed, maxTokens);
  if (charChunks.length > 1) {
    return charChunks;
  }

  return [trimmed];
}

function expandSectionBodies(
  sections: Section[],
  options: ChunkMarkdownOptions,
): Array<{ headingPath: string[]; body: string }> {
  const strategy = options.strategy ?? 'headings';
  const expanded: Array<{ headingPath: string[]; body: string }> = [];

  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    if (!body) {
      continue;
    }

    if (strategy === 'headings') {
      expanded.push({ headingPath: section.headingPath, body });
      continue;
    }

    const parts = splitNaturalParts(body);
    const bodies =
      strategy === 'headings_subsplit_capped'
        ? parts.flatMap((part) => capSplitText(part, options.maxChunkTokens ?? 512))
        : parts;

    for (const partBody of bodies) {
      if (partBody.trim()) {
        expanded.push({ headingPath: section.headingPath, body: partBody.trim() });
      }
    }
  }

  return expanded;
}

export function resolveChunkerVersion(options: ChunkMarkdownOptions = {}): string {
  const strategy = options.strategy ?? 'headings';
  return strategy === 'headings' ? markdownChunkerVersion : markdownChunkerVersionV2;
}

export function chunkMarkdownBody(
  body: string,
  options: ChunkMarkdownOptions = {},
): MarkdownChunkDraft[] {
  const lines = body.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section = { headingPath: [], lines: [] };
  const headingStack: Array<{ level: number; title: string }> = [];

  for (const line of lines) {
    const headingMatch = headingPattern.exec(line);
    if (headingMatch) {
      if (current.lines.length > 0 || sections.length === 0) {
        sections.push(current);
      }

      const level = headingMatch[1]?.length ?? 1;
      const title = headingMatch[2]?.trim() ?? '';
      while (headingStack.length > 0 && (headingStack.at(-1)?.level ?? 0) >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, title });
      current = {
        headingPath: headingStack.map((entry) => entry.title),
        lines: [],
      };
      continue;
    }

    current.lines.push(line);
  }

  sections.push(current);

  const nonEmpty = sections.filter((section) => section.lines.join('\n').trim().length > 0);
  const sourceSections = nonEmpty.length > 0 ? nonEmpty : [{ headingPath: [], lines: [''] }];
  const expanded = expandSectionBodies(sourceSections, options);

  if (expanded.length === 0) {
    return [
      {
        ordinal: 0,
        headingPath: [],
        body: '',
        bodyPreview: '',
        tokenCount: 0,
      },
    ];
  }

  return expanded.map((entry, ordinal) => ({
    ordinal,
    headingPath: entry.headingPath,
    body: entry.body,
    bodyPreview: makePreview(entry.body),
    tokenCount: estimateTokenCount(entry.body),
  }));
}
