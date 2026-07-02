import { estimateTokenCount } from './chunker.js';
import type { MarkdownChunkDraft } from './types.js';

export function resolveIndexFrontmatterSummary(env: Record<string, string | undefined>): boolean {
  const raw = env.EVUKB_INDEX_FRONTMATTER_SUMMARY?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function formatFrontmatterSummaryBody(parsed: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}=${String(value)}`);
    } else if (Array.isArray(value)) {
      parts.push(`${key}=${value.map(String).join(',')}`);
    }
  }
  return parts.length > 0 ? `Frontmatter: ${parts.join('; ')}` : '';
}

export function prependFrontmatterSummaryChunk(
  chunks: MarkdownChunkDraft[],
  parsed: Record<string, unknown>,
): MarkdownChunkDraft[] {
  const body = formatFrontmatterSummaryBody(parsed);
  if (!body) {
    return chunks;
  }
  const summaryChunk: MarkdownChunkDraft = {
    ordinal: 0,
    headingPath: ['Frontmatter'],
    body,
    bodyPreview: body.length > 240 ? `${body.slice(0, 239)}…` : body,
    tokenCount: estimateTokenCount(body),
  };
  return [
    summaryChunk,
    ...chunks.map((chunk, index) => ({
      ...chunk,
      ordinal: index + 1,
    })),
  ];
}
