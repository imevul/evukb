import type { KnowledgeFilters } from '@evu/kb-sdk';

export type SearchFilterDraft = {
  tags: string;
  fileType: string;
  okfType: string;
  pathAllowlist: string;
  frontmatter: string;
  sourceTypes: string[];
  indexStatus: string[];
  showAdvanced: boolean;
};

export const emptySearchFilterDraft = (): SearchFilterDraft => ({
  tags: '',
  fileType: '',
  okfType: '',
  pathAllowlist: '',
  frontmatter: '',
  sourceTypes: [],
  indexStatus: [],
  showAdvanced: false,
});

function parseFrontmatterDraft(raw: string): Record<string, string> | undefined {
  const parsed: Record<string, string> = {};
  for (const entry of raw.split(',')) {
    const [key, ...rest] = entry.split(':');
    const trimmedKey = key?.trim();
    const value = rest.join(':').trim();
    if (trimmedKey && value) {
      parsed[trimmedKey] = value;
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function buildKnowledgeFilters(draft: SearchFilterDraft): KnowledgeFilters | undefined {
  const tags = draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const fileTypes = draft.fileType
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const okfType = draft.okfType.trim();
  const pathAllowlist = draft.pathAllowlist
    .split(',')
    .map((prefix) => prefix.trim())
    .filter(Boolean);
  const frontmatter = parseFrontmatterDraft(draft.frontmatter);

  const filters: KnowledgeFilters = {};
  if (tags.length > 0) {
    filters.tags = tags;
  }
  if (fileTypes.length > 0) {
    filters.fileTypes = fileTypes;
  }
  if (okfType) {
    filters.okfType = okfType;
  }
  if (pathAllowlist.length > 0) {
    filters.pathAllowlist = pathAllowlist;
  }
  if (frontmatter) {
    filters.frontmatter = frontmatter;
  }
  if (draft.sourceTypes.length > 0) {
    filters.sourceTypes = [...draft.sourceTypes] as NonNullable<KnowledgeFilters['sourceTypes']>;
  }
  if (draft.indexStatus.length > 0) {
    filters.indexStatus = [...draft.indexStatus] as NonNullable<KnowledgeFilters['indexStatus']>;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}
