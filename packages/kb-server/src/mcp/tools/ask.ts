import { parseKnowledgeFilters } from '@evu/kb-core';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleAskTool } from '../../services/kb-tool-handlers.js';
import { knowledgeFiltersSchema } from '../schemas/knowledge-filters.js';
import { withMcpToolContext } from '../tool-runtime.js';

const askSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().optional().describe('Single knowledge corpus ID.'),
  corpusIds: z
    .array(z.string())
    .min(1)
    .optional()
    .describe('One or more corpus IDs for multi-corpus ask.'),
  question: z.string().describe('Question to answer from corpus content.'),
  nodeId: z.string().optional().describe('Optional node scope for retrieval.'),
  pathPrefix: z.string().optional().describe('Optional path prefix filter.'),
  filters: knowledgeFiltersSchema,
  maxContextChunks: z.number().int().positive().optional().describe('Maximum context chunks.'),
  responseMode: z.enum(['concise', 'detailed', 'extractive']).optional().describe('Answer style.'),
  rankingStrategyId: z
    .string()
    .optional()
    .describe('Override ranking strategy for retrieval (e.g. citation_boosted).'),
});

export function registerAskTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.ask',
    {
      title: 'Ask corpus',
      description:
        'Optional convenience RAG using EvuKB chat model. Prefer evu.kb.search when the MCP client has its own LLM. May be disabled on MCP (EVUKB_MCP_ENABLE_ASK).',
      inputSchema: askSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const corpusIds = args.corpusIds ?? (args.corpusId ? [args.corpusId] : undefined);
        if (!corpusIds || corpusIds.length === 0) {
          throw new Error('corpusId or corpusIds is required.');
        }

        const filters =
          args.filters !== undefined ? parseKnowledgeFilters(args.filters) : undefined;

        const response = await handleAskTool(runtime, workspace.id, {
          action: 'ask',
          question: args.question,
          corpusIds,
          ...(args.nodeId !== undefined ? { nodeId: args.nodeId } : {}),
          ...(args.pathPrefix !== undefined ? { pathPrefix: args.pathPrefix } : {}),
          ...(filters !== undefined ? { filters } : {}),
          ...(args.maxContextChunks !== undefined
            ? { maxContextChunks: args.maxContextChunks }
            : {}),
          ...(args.responseMode !== undefined ? { responseMode: args.responseMode } : {}),
          ...(args.rankingStrategyId !== undefined
            ? { rankingStrategyId: args.rankingStrategyId }
            : {}),
        });
        return response.result;
      }),
  );
}
