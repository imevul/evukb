import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleListCorpora } from '../../services/kb-tool-handlers.js';
import { withMcpToolContext } from '../tool-runtime.js';

const workspaceScopedSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
});

export function registerCorpusTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.corpora.list',
    {
      title: 'List corpora',
      description: 'List knowledge corpora in a workspace.',
      inputSchema: workspaceScopedSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleListCorpora(runtime, workspace.id, { action: 'list_corpora' });
        return response.result;
      }),
  );
}
