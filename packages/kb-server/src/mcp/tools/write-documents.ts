import type { KbWriteActor } from '@evu/kb-core';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { EvuKbRuntime } from '../../index.js';
import { getMcpRequestAuth } from '../request-context.js';
import { withMcpWriteToolContext } from '../tool-runtime.js';

const corpusScopedSchema = z.object({
  workspaceId: z
    .string()
    .optional()
    .describe('Workspace UUID or slug; defaults to x-evukb-workspace-id header or local-dev.'),
  corpusId: z.string().describe('Knowledge corpus ID.'),
});

function actorFromMcpAuth(): KbWriteActor {
  const auth = getMcpRequestAuth();
  if (auth?.kind === 'db' && auth.tokenId) {
    return { kind: 'mcp_token', tokenId: auth.tokenId };
  }
  if (auth?.kind === 'dev') {
    return { kind: 'dev' };
  }
  return { kind: 'open' };
}

export function registerWriteDocumentTools(server: McpServer, runtime: EvuKbRuntime): void {
  server.registerTool(
    'evu.kb.append_document',
    {
      title: 'Append document',
      description:
        'Append UTF-8 content to a managed agent write path, creating the file when missing.',
      inputSchema: corpusScopedSchema.extend({
        path: z.string().describe('Full path under an allowed write prefix, including file name.'),
        body: z.string().describe('UTF-8 content to append.'),
      }),
    },
    async (args, ctx) =>
      withMcpWriteToolContext(runtime, ctx, args.workspaceId, async (workspace) =>
        runtime.agentWriteService.execute(workspace.id, actorFromMcpAuth(), {
          action: 'append_document',
          corpusId: args.corpusId,
          path: args.path,
          body: args.body,
        }),
      ),
  );

  server.registerTool(
    'evu.kb.create_document',
    {
      title: 'Create document',
      description: 'Create a managed file under an allowed agent write path prefix.',
      inputSchema: corpusScopedSchema.extend({
        path: z.string().describe('Folder path under an allowed write prefix.'),
        name: z.string().describe('File name.'),
        body: z.string().describe('Initial UTF-8 file content.'),
      }),
    },
    async (args, ctx) =>
      withMcpWriteToolContext(runtime, ctx, args.workspaceId, async (workspace) =>
        runtime.agentWriteService.execute(workspace.id, actorFromMcpAuth(), {
          action: 'create_document',
          corpusId: args.corpusId,
          path: args.path,
          name: args.name,
          body: args.body,
        }),
      ),
  );

  server.registerTool(
    'evu.kb.update_document',
    {
      title: 'Update document',
      description: 'Replace managed file content by node ID.',
      inputSchema: corpusScopedSchema.extend({
        nodeId: z.string().describe('File node ID.'),
        body: z.string().describe('Replacement UTF-8 file content.'),
      }),
    },
    async (args, ctx) =>
      withMcpWriteToolContext(runtime, ctx, args.workspaceId, async (workspace) =>
        runtime.agentWriteService.execute(workspace.id, actorFromMcpAuth(), {
          action: 'update_document',
          corpusId: args.corpusId,
          nodeId: args.nodeId,
          body: args.body,
        }),
      ),
  );

  server.registerTool(
    'evu.kb.delete_document',
    {
      title: 'Delete document',
      description: 'Delete a managed node by ID.',
      inputSchema: corpusScopedSchema.extend({
        nodeId: z.string().describe('Node ID to delete.'),
      }),
    },
    async (args, ctx) =>
      withMcpWriteToolContext(runtime, ctx, args.workspaceId, async (workspace) =>
        runtime.agentWriteService.execute(workspace.id, actorFromMcpAuth(), {
          action: 'delete_document',
          corpusId: args.corpusId,
          nodeId: args.nodeId,
        }),
      ),
  );
}
