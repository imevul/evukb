import { z } from 'zod';

const nodeSourceTypeSchema = z.enum(['managed', 'shared_mount', 'git', 'reference', 'import']);

const indexStatusSchema = z.enum(['pending', 'indexing', 'indexed', 'stale', 'failed']);

export const knowledgeFiltersSchema = z
  .object({
    tags: z.array(z.string()).optional().describe('Match nodes with any listed frontmatter tag.'),
    fileTypes: z
      .array(z.string())
      .optional()
      .describe('Match file types such as markdown, md, or text/markdown.'),
    okfType: z.string().optional().describe('Match OKF frontmatter type.'),
    pathAllowlist: z
      .array(z.string())
      .optional()
      .describe('Match file paths under any listed prefix.'),
    frontmatter: z
      .record(z.string(), z.string())
      .optional()
      .describe('Exact frontmatter field matches (case-insensitive values).'),
    sourceTypes: z.array(nodeSourceTypeSchema).optional().describe('Match nodes by source type.'),
    indexStatus: z.array(indexStatusSchema).optional().describe('Match nodes by index status.'),
  })
  .optional()
  .describe(
    'Optional metadata filters applied during retrieval (SQL keyword pre-filter and post-filter on vector hits).',
  );
