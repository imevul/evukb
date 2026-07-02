import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { EvuKbRuntime } from '../runtime/types.js';
import { resolveMcpHttpAuth } from './context.js';
import { type McpRequestAuth, runWithMcpAuth } from './request-context.js';
import { buildMcpServer } from './server.js';

export type McpPluginOptions = {
  runtime: EvuKbRuntime;
};

export const mcpRoutesPlugin: FastifyPluginAsync<McpPluginOptions> = async (server, options) => {
  const mcpServer = buildMcpServer(options.runtime);

  server.post('/mcp', async (request, reply) => {
    let auth: McpRequestAuth;
    try {
      auth = await resolveMcpHttpAuth(options.runtime.tokenAuth, request.headers);
    } catch (error) {
      if (error instanceof ApiError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }

    reply.hijack();

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await mcpServer.connect(transport);
    await runWithMcpAuth(auth, async () => {
      await transport.handleRequest(request.raw, reply.raw, request.body);
    });
  });

  server.get('/mcp', async (request, reply) => {
    let auth: McpRequestAuth;
    try {
      auth = await resolveMcpHttpAuth(options.runtime.tokenAuth, request.headers);
    } catch (error) {
      if (error instanceof ApiError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }

    reply.hijack();

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await mcpServer.connect(transport);
    await runWithMcpAuth(auth, async () => {
      await transport.handleRequest(request.raw, reply.raw);
    });
  });
};

export {
  assertMcpDevAuth,
  assertMcpReadScope,
  assertMcpRequestAuthorized,
  EVUKB_WORKSPACE_HEADER,
  resolveMcpHttpAuth,
  resolveWorkspace,
} from './context.js';
export { runWithMcpAuth } from './request-context.js';
export { buildMcpServer } from './server.js';
export { toolError, toolSuccess, withMcpToolContext } from './tool-runtime.js';
