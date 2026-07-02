import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { withMcpToolContext } from '../tool-runtime.js';

export function registerWorkspaceTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.workspaces.list',
    {
      title: 'List workspaces',
      description: 'List all knowledge workspaces accessible to this server.',
      inputSchema: z.object({
        workspaceId: z
          .string()
          .optional()
          .describe('Ignored for this tool; workspace context is not required.'),
      }),
    },
    async (_args, ctx) =>
      withMcpToolContext(runtime, ctx, undefined, async () => runtime.workspaces.list()),
  );
}
