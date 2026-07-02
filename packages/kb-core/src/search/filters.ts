import type { KnowledgeNode } from '../node.js';
import { extractConceptFrontmatter } from '../okf/read.js';
import type { IndexStatus, NodeSourceType } from '../runtime.js';
import { matchesGlobPattern } from './glob-match.js';

export type KnowledgeFilters = {
  tags?: string[];
  fileTypes?: string[];
  okfType?: string;
  pathAllowlist?: string[];
  frontmatter?: Record<string, string>;
  sourceTypes?: NodeSourceType[];
  indexStatus?: IndexStatus[];
};

const maxFilterTags = 16;
const maxFilterFileTypes = 8;
const maxPathAllowlist = 16;
const maxFrontmatterKeys = 8;
const maxSourceTypes = 8;
const maxIndexStatus = 8;

const nodeSourceTypes: NodeSourceType[] = ['managed', 'shared_mount', 'git', 'reference', 'import'];
const indexStatuses: IndexStatus[] = ['pending', 'indexing', 'indexed', 'stale', 'failed'];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePathPrefix(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function nodeRelativeFilePath(node: KnowledgeNode): string {
  return node.path ? `${node.path}/${node.name}` : node.name;
}

function nodeFileTypeTokens(node: KnowledgeNode): string[] {
  const tokens = new Set<string>();
  if (node.mimeType?.trim()) {
    tokens.add(normalizeToken(node.mimeType));
  }
  const extension = node.name.includes('.') ? node.name.split('.').pop() : null;
  if (extension) {
    tokens.add(normalizeToken(extension));
  }
  if (node.name.toLowerCase().endsWith('.md')) {
    tokens.add('md');
    tokens.add('markdown');
    tokens.add('text/markdown');
    tokens.add('text/x-markdown');
  }
  return [...tokens];
}

function normalizeFileTypeFilter(value: string): string {
  const normalized = normalizeToken(value);
  if (normalized === 'markdown' || normalized === 'text/x-markdown') {
    return 'md';
  }
  if (normalized === 'text/markdown') {
    return 'md';
  }
  return normalized.replace(/^\./, '');
}

function pathMatchesAllowlist(filePath: string, allowlist: string[]): boolean {
  const normalizedPath = normalizePathPrefix(filePath);
  return allowlist.some((prefix) => {
    const normalizedPrefix = normalizePathPrefix(prefix);
    if (!normalizedPrefix) {
      return true;
    }
    return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
  });
}

function readFrontmatterField(metadata: Record<string, unknown>, key: string): string | null {
  const frontmatter = metadata.frontmatter;
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return null;
  }
  const value = (frontmatter as Record<string, unknown>)[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const values = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function parseFrontmatterFilter(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.trim()) {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      continue;
    }
    parsed[key.trim()] = value.trim();
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function parseSourceTypes(raw: unknown): NodeSourceType[] | undefined {
  const values = parseStringArray(raw);
  if (!values) {
    return undefined;
  }
  const filtered = values.filter((value): value is NodeSourceType =>
    nodeSourceTypes.includes(value as NodeSourceType),
  );
  return filtered.length > 0 ? filtered : undefined;
}

function parseIndexStatuses(raw: unknown): IndexStatus[] | undefined {
  const values = parseStringArray(raw);
  if (!values) {
    return undefined;
  }
  const filtered = values.filter((value): value is IndexStatus =>
    indexStatuses.includes(value as IndexStatus),
  );
  return filtered.length > 0 ? filtered : undefined;
}

export function parseKnowledgeFilters(raw: unknown): KnowledgeFilters | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const parsed: KnowledgeFilters = {};

  const tags = parseStringArray(input.tags);
  if (tags) {
    parsed.tags = tags;
  }

  const fileTypes = parseStringArray(input.fileTypes);
  if (fileTypes) {
    parsed.fileTypes = fileTypes;
  }

  if (typeof input.okfType === 'string' && input.okfType.trim()) {
    parsed.okfType = input.okfType.trim();
  }

  const pathAllowlist = parseStringArray(input.pathAllowlist);
  if (pathAllowlist) {
    parsed.pathAllowlist = pathAllowlist.map(normalizePathPrefix).filter(Boolean);
  }

  const frontmatter = parseFrontmatterFilter(input.frontmatter);
  if (frontmatter) {
    parsed.frontmatter = frontmatter;
  }

  const sourceTypes = parseSourceTypes(input.sourceTypes);
  if (sourceTypes) {
    parsed.sourceTypes = sourceTypes;
  }

  const indexStatus = parseIndexStatuses(input.indexStatus);
  if (indexStatus) {
    parsed.indexStatus = indexStatus;
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function validateKnowledgeFilters(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return 'filters must be an object.';
  }

  const input = raw as Record<string, unknown>;
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      return 'filters.tags must be an array.';
    }
    if (input.tags.length > maxFilterTags) {
      return `filters.tags must contain at most ${maxFilterTags} entries.`;
    }
    for (const tag of input.tags) {
      if (typeof tag !== 'string') {
        return 'filters.tags entries must be strings.';
      }
    }
  }

  if (input.fileTypes !== undefined) {
    if (!Array.isArray(input.fileTypes)) {
      return 'filters.fileTypes must be an array.';
    }
    if (input.fileTypes.length > maxFilterFileTypes) {
      return `filters.fileTypes must contain at most ${maxFilterFileTypes} entries.`;
    }
    for (const fileType of input.fileTypes) {
      if (typeof fileType !== 'string') {
        return 'filters.fileTypes entries must be strings.';
      }
    }
  }

  if (input.okfType !== undefined && typeof input.okfType !== 'string') {
    return 'filters.okfType must be a string.';
  }

  if (input.pathAllowlist !== undefined) {
    if (!Array.isArray(input.pathAllowlist)) {
      return 'filters.pathAllowlist must be an array.';
    }
    if (input.pathAllowlist.length > maxPathAllowlist) {
      return `filters.pathAllowlist must contain at most ${maxPathAllowlist} entries.`;
    }
    for (const prefix of input.pathAllowlist) {
      if (typeof prefix !== 'string') {
        return 'filters.pathAllowlist entries must be strings.';
      }
    }
  }

  if (input.frontmatter !== undefined) {
    if (
      !input.frontmatter ||
      typeof input.frontmatter !== 'object' ||
      Array.isArray(input.frontmatter)
    ) {
      return 'filters.frontmatter must be an object.';
    }
    const keys = Object.keys(input.frontmatter as Record<string, unknown>);
    if (keys.length > maxFrontmatterKeys) {
      return `filters.frontmatter must contain at most ${maxFrontmatterKeys} keys.`;
    }
    for (const [key, value] of Object.entries(input.frontmatter as Record<string, unknown>)) {
      if (typeof key !== 'string' || !key.trim()) {
        return 'filters.frontmatter keys must be non-empty strings.';
      }
      if (typeof value !== 'string') {
        return 'filters.frontmatter values must be strings.';
      }
    }
  }

  if (input.sourceTypes !== undefined) {
    if (!Array.isArray(input.sourceTypes)) {
      return 'filters.sourceTypes must be an array.';
    }
    if (input.sourceTypes.length > maxSourceTypes) {
      return `filters.sourceTypes must contain at most ${maxSourceTypes} entries.`;
    }
    for (const sourceType of input.sourceTypes) {
      if (
        typeof sourceType !== 'string' ||
        !nodeSourceTypes.includes(sourceType as NodeSourceType)
      ) {
        return 'filters.sourceTypes entries must be valid node source types.';
      }
    }
  }

  if (input.indexStatus !== undefined) {
    if (!Array.isArray(input.indexStatus)) {
      return 'filters.indexStatus must be an array.';
    }
    if (input.indexStatus.length > maxIndexStatus) {
      return `filters.indexStatus must contain at most ${maxIndexStatus} entries.`;
    }
    for (const status of input.indexStatus) {
      if (typeof status !== 'string' || !indexStatuses.includes(status as IndexStatus)) {
        return 'filters.indexStatus entries must be valid index statuses.';
      }
    }
  }

  return null;
}

export function hasKnowledgeFilters(
  filters: KnowledgeFilters | undefined,
): filters is KnowledgeFilters {
  if (!filters) {
    return false;
  }
  return Boolean(
    (filters.tags && filters.tags.length > 0) ||
      (filters.fileTypes && filters.fileTypes.length > 0) ||
      filters.okfType ||
      (filters.pathAllowlist && filters.pathAllowlist.length > 0) ||
      (filters.frontmatter && Object.keys(filters.frontmatter).length > 0) ||
      (filters.sourceTypes && filters.sourceTypes.length > 0) ||
      (filters.indexStatus && filters.indexStatus.length > 0),
  );
}

export function filtersNeedSqlJoin(filters: KnowledgeFilters | undefined): boolean {
  if (!hasKnowledgeFilters(filters)) {
    return false;
  }
  return Boolean(
    (filters.tags && filters.tags.length > 0) ||
      filters.okfType ||
      (filters.pathAllowlist && filters.pathAllowlist.length > 0) ||
      (filters.sourceTypes && filters.sourceTypes.length > 0) ||
      (filters.indexStatus && filters.indexStatus.length > 0) ||
      (filters.frontmatter && Object.keys(filters.frontmatter).length > 0),
  );
}

export function nodeMatchesKnowledgeFilters(
  node: KnowledgeNode,
  filters: KnowledgeFilters | undefined,
  filePath?: string,
): boolean {
  if (!hasKnowledgeFilters(filters)) {
    return true;
  }

  const frontmatter = extractConceptFrontmatter(node.metadata);
  const resolvedPath = filePath ?? nodeRelativeFilePath(node);

  if (filters.pathAllowlist && filters.pathAllowlist.length > 0) {
    if (!pathMatchesAllowlist(resolvedPath, filters.pathAllowlist)) {
      return false;
    }
  }

  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    if (!filters.sourceTypes.includes(node.sourceType)) {
      return false;
    }
  }

  if (filters.indexStatus && filters.indexStatus.length > 0) {
    if (!filters.indexStatus.includes(node.indexStatus)) {
      return false;
    }
  }

  if (filters.tags && filters.tags.length > 0) {
    const wanted = new Set(filters.tags.map(normalizeToken));
    const nodeTags = frontmatter.tags.map(normalizeToken);
    const matchesTag = nodeTags.some((tag) => wanted.has(tag));
    if (!matchesTag) {
      return false;
    }
  }

  if (filters.okfType) {
    const wantedType = normalizeToken(filters.okfType);
    const nodeType = frontmatter.type ? normalizeToken(frontmatter.type) : '';
    if (nodeType !== wantedType) {
      return false;
    }
  }

  if (filters.frontmatter && Object.keys(filters.frontmatter).length > 0) {
    for (const [key, wantedValue] of Object.entries(filters.frontmatter)) {
      const actual = readFrontmatterField(node.metadata, key);
      if (!actual || !matchesGlobPattern(actual, wantedValue)) {
        return false;
      }
    }
  }

  if (filters.fileTypes && filters.fileTypes.length > 0) {
    const wanted = new Set(filters.fileTypes.map(normalizeFileTypeFilter));
    const nodeTokens = nodeFileTypeTokens(node).map(normalizeFileTypeFilter);
    const matchesFileType = nodeTokens.some((token) => wanted.has(token));
    if (!matchesFileType) {
      return false;
    }
  }

  return true;
}
