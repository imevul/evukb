import { hasKnowledgeFilters, type KnowledgeFilters } from '../search/filters.js';

export type SearchScopeInput = {
  query?: string;
  pathPrefix?: string;
  filters?: KnowledgeFilters;
};

export function normalizeSearchQuery(query?: string): string {
  return query?.trim() ?? '';
}

export function allowsMetadataOnlySearch(input: SearchScopeInput): boolean {
  return (
    normalizeSearchQuery(input.query).length === 0 &&
    (hasKnowledgeFilters(input.filters) || Boolean(input.pathPrefix?.trim()))
  );
}

export function assertSearchQueryOrScope(input: SearchScopeInput): void {
  const query = normalizeSearchQuery(input.query);
  if (query.length > 0) {
    return;
  }
  if (allowsMetadataOnlySearch(input)) {
    return;
  }
  throw new Error('Search query is required unless filters or pathPrefix scope the request.');
}
