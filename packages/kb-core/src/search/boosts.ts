import { extractCitationUrls } from '../okf/citations.js';

const recencyHalfLifeDays = 30;

function normalizeForTitleMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveRecencyMultiplier(
  indexedAt: string | undefined,
  recencyBoost: number | undefined,
  nowMs: number = Date.now(),
): number {
  const boost = recencyBoost ?? 0;
  if (boost <= 0 || !indexedAt) {
    return 1;
  }

  const indexedMs = Date.parse(indexedAt);
  if (!Number.isFinite(indexedMs)) {
    return 1;
  }

  const ageDays = Math.max(0, (nowMs - indexedMs) / (24 * 60 * 60 * 1000));
  return 1 + boost * Math.exp(-ageDays / recencyHalfLifeDays);
}

export function isOkfCitationSectionHeading(headingPath: string[]): boolean {
  return headingPath.some((heading) => normalizeForTitleMatch(heading) === 'citations');
}

export function isOkfCitationChunkContent(headingPath: string[], body?: string): boolean {
  if (isOkfCitationSectionHeading(headingPath)) {
    return true;
  }
  if (!body?.trim()) {
    return false;
  }
  return extractCitationUrls(body.trim()).length > 0;
}

export function resolveOkfCitationMultiplier(
  isOkfCitationSection: boolean,
  okfCitationBoost: number | undefined,
): number {
  const boost = okfCitationBoost ?? 0;
  if (boost <= 0 || !isOkfCitationSection) {
    return 1;
  }
  return 1 + boost;
}

export function resolveExactTitleMultiplier(
  query: string | undefined,
  nodeTitle: string | undefined,
  exactTitleBoost: number | undefined,
): number {
  const boost = exactTitleBoost ?? 0;
  if (boost <= 0 || !query?.trim() || !nodeTitle?.trim()) {
    return 1;
  }

  const normalizedQuery = normalizeForTitleMatch(query);
  const normalizedTitle = normalizeForTitleMatch(nodeTitle);
  if (normalizedQuery.length === 0 || normalizedQuery !== normalizedTitle) {
    return 1;
  }

  return 1 + boost;
}

export function resolveNodeTitleFromMetadata(metadata: Record<string, unknown>): string | null {
  const frontmatter = metadata.frontmatter;
  if (frontmatter && typeof frontmatter === 'object' && !Array.isArray(frontmatter)) {
    const title = (frontmatter as Record<string, unknown>).title;
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }
  }

  const directTitle = metadata.title;
  if (typeof directTitle === 'string' && directTitle.trim().length > 0) {
    return directTitle.trim();
  }

  return null;
}
