import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleListConcepts, handleReadIndex } from '../../services/kb-tool-handlers.js';
import { withMcpToolContext } from '../tool-runtime.js';

const corpusScopedSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
});

export function registerOkfTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.read_index',
    {
      title: 'Read OKF index',
      description: 'Read index.md for an OKF corpus directory.',
      inputSchema: corpusScopedSchema.extend({
        documentPath: z
          .string()
          .optional()
          .describe('Directory path or index.md path within the corpus.'),
      }),
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleReadIndex(runtime, workspace.id, {
          action: 'read_index',
          corpusId: args.corpusId,
          ...(args.documentPath !== undefined ? { documentPath: args.documentPath } : {}),
        });
        return response.result;
      }),
  );

  server.registerTool(
    'evu.kb.list_concepts',
    {
      title: 'List OKF concepts',
      description:
        'OKF corpora only (formatProfile okf). List concept documents with optional type and tag filters. Not for generic Obsidian vaults.',
      inputSchema: corpusScopedSchema.extend({
        pathPrefix: z.string().optional().describe('Limit concepts under a folder prefix.'),
        conceptType: z.string().optional().describe('Filter by frontmatter type.'),
        tag: z.string().optional().describe('Filter by frontmatter tag.'),
        limit: z.number().int().positive().optional().describe('Maximum concepts to return.'),
        offset: z.number().int().min(0).optional().describe('Pagination offset.'),
      }),
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleListConcepts(runtime, workspace.id, {
          action: 'list_concepts',
          corpusId: args.corpusId,
          ...(args.pathPrefix !== undefined ? { pathPrefix: args.pathPrefix } : {}),
          ...(args.conceptType !== undefined ? { conceptType: args.conceptType } : {}),
          ...(args.tag !== undefined ? { tag: args.tag } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
        });
        return response.result;
      }),
  );
}
