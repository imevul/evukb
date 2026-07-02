import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { handleReadChunk } from '../../services/kb-tool-handlers.js';
import { withMcpToolContext } from '../tool-runtime.js';

const chunkSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
  chunkId: z.string().describe('Chunk ID.'),
});

export function registerChunkTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.read_chunk',
    {
      title: 'Read chunk',
      description: 'Read indexed chunk body and metadata.',
      inputSchema: chunkSchema,
    },
    async (args, ctx) =>
      withMcpToolContext(runtime, ctx, args.workspaceId, async (workspace) => {
        const response = await handleReadChunk(runtime, workspace.id, {
          action: 'read_chunk',
          corpusId: args.corpusId,
          chunkId: args.chunkId,
        });
        return response.result;
      }),
  );
}
