import type { KnowledgeNode } from '../node.js';
import {
  hasKnowledgeFilters,
  type KnowledgeFilters,
  nodeMatchesKnowledgeFilters,
  nodeRelativeFilePath,
} from '../search/filters.js';

export type DocumentInventoryRow = {
  nodeId: string;
  path: string;
  indexStatus: KnowledgeNode['indexStatus'];
  frontmatter?: Record<string, unknown>;
};

export type ListDocumentsInventoryOptions = {
  pathPrefix?: string;
  filters?: KnowledgeFilters;
  fields?: string[];
  limit?: number;
  offset?: number;
};

const defaultInventoryLimit = 100;
const maxInventoryLimit = 500;

function normalizePathPrefix(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function matchesDocumentPathPrefix(filePath: string, pathPrefix?: string): boolean {
  if (!pathPrefix?.trim()) {
    return true;
  }
  const normalizedPrefix = normalizePathPrefix(pathPrefix.trim());
  const normalizedPath = normalizePathPrefix(filePath);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

export function readNodeFrontmatter(metadata: Record<string, unknown>): Record<string, unknown> {
  const frontmatter = metadata.frontmatter;
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return {};
  }
  return frontmatter as Record<string, unknown>;
}

export function projectFrontmatterFields(
  metadata: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> | undefined {
  const source = readNodeFrontmatter(metadata);
  if (!fields || fields.length === 0) {
    return Object.keys(source).length > 0 ? source : undefined;
  }
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field.trim();
    if (!key || !(key in source)) {
      continue;
    }
    projected[key] = source[key];
  }
  return Object.keys(projected).length > 0 ? projected : undefined;
}

export function formatFrontmatterPreview(metadata: Record<string, unknown>): string {
  const source = readNodeFrontmatter(metadata);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(source)) {
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

export function hasListDocumentsInventoryOptions(options: ListDocumentsInventoryOptions): boolean {
  return Boolean(
    options.pathPrefix?.trim() ||
      (options.fields && options.fields.length > 0) ||
      options.limit !== undefined ||
      options.offset !== undefined ||
      hasKnowledgeFilters(options.filters),
  );
}

export function buildDocumentInventoryRows(
  nodes: KnowledgeNode[],
  options: ListDocumentsInventoryOptions = {},
): DocumentInventoryRow[] {
  const limit = Math.min(Math.max(options.limit ?? defaultInventoryLimit, 1), maxInventoryLimit);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows: DocumentInventoryRow[] = [];
  for (const node of nodes) {
    if (node.nodeType !== 'file') {
      continue;
    }
    const filePath = nodeRelativeFilePath(node);
    if (!matchesDocumentPathPrefix(filePath, options.pathPrefix)) {
      continue;
    }
    if (!nodeMatchesKnowledgeFilters(node, options.filters, filePath)) {
      continue;
    }
    const frontmatter = projectFrontmatterFields(node.metadata, options.fields);
    rows.push({
      nodeId: node.id,
      path: filePath,
      indexStatus: node.indexStatus,
      ...(frontmatter ? { frontmatter } : {}),
    });
  }

  rows.sort((left, right) => left.path.localeCompare(right.path));
  return rows.slice(offset, offset + limit);
}
