import type { IndexStatus } from './node.js';

export type NodeSourceType = 'managed' | 'shared_mount' | 'git' | 'reference' | 'import';

export type KnowledgeFilters = {
  tags?: string[];
  fileTypes?: string[];
  okfType?: string;
  pathAllowlist?: string[];
  frontmatter?: Record<string, string>;
  sourceTypes?: NodeSourceType[];
  indexStatus?: IndexStatus[];
};

export type { IndexStatus };
