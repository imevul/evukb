import { parseKnowledgeFilters, type RankingSettings } from '@evu/kb-core';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleSearch } from '../../services/kb-tool-handlers.js';
import { knowledgeFiltersSchema } from '../schemas/knowledge-filters.js';
import { rankingSettingsSchema } from '../schemas/ranking-settings.js';
import { withMcpToolContext } from '../tool-runtime.js';

const searchSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().optional().describe('Knowledge corpus ID for single-corpus search.'),
  corpusIds: z
    .array(z.string())
    .min(1)
    .optional()
    .describe('Corpus IDs for multi-corpus search (1–10).'),
  query: z
    .string()
    .optional()
    .describe(
      'Search query. Omit when filters and/or pathPrefix scope metadata-only discovery (returns one hit per matching node).',
    ),
  pathPrefix: z.string().optional().describe('Optional path prefix filter.'),
  limit: z.number().int().positive().optional().describe('Maximum number of results.'),
  filters: knowledgeFiltersSchema,
  rankingStrategyId: z
    .string()
    .optional()
    .describe('Override ranking strategy for this search (e.g. recency_boosted).'),
  rankingSettings: rankingSettingsSchema
    .optional()
    .describe('Optional per-request ranking weight overrides.'),
});

export function registerSearchTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.search',
    {
      title: 'Search corpus',
      description:
        'Prefer for capable MCP agents. Hybrid keyword and semantic search over indexed chunks for the outer agent to synthesize. Supports pathPrefix and filters.frontmatter. Omit query when filters/pathPrefix are set for metadata-only node discovery.',
      inputSchema: searchSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const corpusIds = args.corpusIds ?? (args.corpusId ? [args.corpusId] : undefined);
        if (!corpusIds || corpusIds.length === 0) {
          throw new Error('corpusId or corpusIds is required.');
        }

        const filters =
          args.filters !== undefined ? parseKnowledgeFilters(args.filters) : undefined;

        const response = await handleSearch(runtime, workspace.id, {
          action: 'search',
          corpusIds,
          ...(args.query !== undefined ? { query: args.query } : {}),
          ...(args.pathPrefix !== undefined ? { pathPrefix: args.pathPrefix } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(filters !== undefined ? { filters } : {}),
          ...(args.rankingStrategyId !== undefined
            ? { rankingStrategyId: args.rankingStrategyId }
            : {}),
          ...(args.rankingSettings !== undefined
            ? { rankingSettings: args.rankingSettings as RankingSettings }
            : {}),
        });
        return response.result;
      }),
  );
}
