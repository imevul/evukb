import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { withMcpToolContext } from '../tool-runtime.js';

const neighborhoodSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
  nodeId: z.string().describe('Center node ID for neighborhood traversal.'),
  depth: z.number().int().positive().optional().describe('Traversal depth from center node.'),
  limit: z.number().int().positive().optional().describe('Maximum nodes in neighborhood.'),
});

export function registerGraphTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.graph_neighborhood',
    {
      title: 'Graph neighborhood',
      description: 'Return a bounded link subgraph around a corpus node.',
      inputSchema: neighborhoodSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) =>
        runtime.linkGraphService.getGraphNeighborhood(workspace.id, args.corpusId, args.nodeId, {
          ...(args.depth !== undefined ? { depth: args.depth } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
      ),
  );
}
