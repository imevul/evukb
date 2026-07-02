import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleFollowLinks } from '../../services/kb-tool-handlers.js';
import { withMcpToolContext } from '../tool-runtime.js';

const linksSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
  nodeId: z.string().describe('Source node ID for outbound links.'),
});

export function registerLinkTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.follow_links',
    {
      title: 'Follow links',
      description: 'List outbound links from a corpus node.',
      inputSchema: linksSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleFollowLinks(runtime, workspace.id, {
          action: 'follow_links',
          corpusId: args.corpusId,
          nodeId: args.nodeId,
        });
        return response.result;
      }),
  );
}
