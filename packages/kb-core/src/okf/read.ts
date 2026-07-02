export type OkfReadIndexResult = {
  corpusId: string;
  directory: string;
  nodeId?: string;
  content: string | null;
  synthesized: boolean;
};

export type OkfConceptSummary = {
  nodeId: string;
  conceptId: string;
  path: string;
  type: string | null;
  title: string | null;
  tags: string[];
};

export type OkfListConceptsResult = {
  corpusId: string;
  concepts: OkfConceptSummary[];
  limit: number;
  offset: number;
};

export function normalizeOkfDirectoryPath(documentPath?: string): string {
  if (!documentPath?.trim()) {
    return '';
  }
  return documentPath
    .trim()
    .replace(/^\//, '')
    .replace(/\/?index\.md$/i, '')
    .replace(/\/$/, '')
    .concat(documentPath.endsWith('/') || documentPath.includes('/') ? '/' : '');
}

export function resolveOkfIndexFolderPath(documentPath?: string): string {
  const normalized = documentPath?.trim().replace(/^\//, '') ?? '';
  if (!normalized) {
    return '';
  }
  if (normalized.toLowerCase().endsWith('index.md')) {
    const withoutIndex = normalized.slice(0, -'index.md'.length).replace(/\/$/, '');
    return withoutIndex.length > 0 ? `${withoutIndex}/` : '';
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

export function extractConceptFrontmatter(metadata: Record<string, unknown>): {
  type: string | null;
  title: string | null;
  tags: string[];
} {
  const frontmatter = metadata.frontmatter;
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return { type: null, title: null, tags: [] };
  }
  const parsed = frontmatter as Record<string, unknown>;
  const type = typeof parsed.type === 'string' ? parsed.type : null;
  const title = typeof parsed.title === 'string' ? parsed.title : null;
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  return { type, title, tags };
}
