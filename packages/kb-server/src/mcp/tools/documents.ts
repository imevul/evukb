import { parseKnowledgeFilters } from '@evu/kb-core';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { EvuKbRuntime } from '../../index.js';
import { handleGetDocument, handleListDocuments } from '../../services/kb-tool-handlers.js';
import { knowledgeFiltersSchema } from '../schemas/knowledge-filters.js';
import { withMcpToolContext } from '../tool-runtime.js';

const corpusScopedSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
});

const listDocumentsSchema = corpusScopedSchema.extend({
  pathPrefix: z.string().optional().describe('Limit inventory to files under this path prefix.'),
  filters: knowledgeFiltersSchema,
  fields: z
    .array(z.string())
    .optional()
    .describe('Optional frontmatter keys to project (e.g. hostname, os, virtual).'),
  limit: z.number().int().positive().optional().describe('Maximum inventory rows (default 100).'),
  offset: z.number().int().min(0).optional().describe('Pagination offset.'),
});

export function registerDocumentTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.list_documents',
    {
      title: 'List documents (inventory)',
      description:
        'Corpus file inventory (not semantic search). Use for structured metadata rollups; supports pathPrefix, filters, pagination, and frontmatter field projection on indexed nodes.',
      inputSchema: listDocumentsSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const filters =
          args.filters !== undefined ? parseKnowledgeFilters(args.filters) : undefined;
        const response = await handleListDocuments(runtime, workspace.id, {
          action: 'list_documents',
          corpusId: args.corpusId,
          ...(args.pathPrefix !== undefined ? { pathPrefix: args.pathPrefix } : {}),
          ...(filters !== undefined ? { filters } : {}),
          ...(args.fields !== undefined ? { fields: args.fields } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
        });
        return response.result;
      }),
  );

  server.registerTool(
    'evu.kb.get_document',
    {
      title: 'Get document',
      description:
        'Read managed file content from a corpus node. Set includeFrontmatter for parsed YAML without regex.',
      inputSchema: corpusScopedSchema.extend({
        nodeId: z.string().describe('File node ID.'),
        includeFrontmatter: z
          .boolean()
          .optional()
          .describe('When true, include parsed frontmatter object alongside body.'),
      }),
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleGetDocument(runtime, workspace.id, {
          action: 'get_document',
          corpusId: args.corpusId,
          nodeId: args.nodeId,
          ...(args.includeFrontmatter !== undefined
            ? { includeFrontmatter: args.includeFrontmatter }
            : {}),
        });
        return response.result;
      }),
  );
}
