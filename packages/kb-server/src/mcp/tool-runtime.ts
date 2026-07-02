import type { Workspace } from '@evu/kb-core';
import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server';

import { ApiError } from '../errors.js';
import type { EvuKbRuntime } from '../runtime/types.js';
import {
  assertMcpReadScope,
  assertMcpRequestAuthorized,
  assertMcpWriteScope,
  resolveWorkspace,
} from './context.js';

export function toolSuccess(output: unknown): CallToolResult {
  const structuredContent: Record<string, unknown> =
    output !== null && typeof output === 'object' && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : { items: output };

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    structuredContent,
  };
}

export function toolError(error: ApiError): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: error.code }) }],
    structuredContent: { error: error.message, code: error.code },
    isError: true,
  };
}

export async function withMcpToolContext<T>(
  runtime: EvuKbRuntime,
  ctx: ServerContext,
  inputWorkspaceId: string | undefined,
  fn: (workspace: Workspace) => Promise<T>,
): Promise<CallToolResult> {
  try {
    const auth = assertMcpRequestAuthorized();
    assertMcpReadScope(auth);
    const workspace = await resolveWorkspace(runtime.workspaces, ctx, inputWorkspaceId, auth);
    const result = await fn(workspace);
    return toolSuccess(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return toolError(error);
    }
    throw error;
  }
}

export async function withMcpWriteToolContext<T>(
  runtime: EvuKbRuntime,
  ctx: ServerContext,
  inputWorkspaceId: string | undefined,
  fn: (workspace: Workspace) => Promise<T>,
): Promise<CallToolResult> {
  try {
    const auth = assertMcpRequestAuthorized();
    assertMcpWriteScope(auth);
    const workspace = await resolveWorkspace(runtime.workspaces, ctx, inputWorkspaceId, auth);
    const result = await fn(workspace);
    return toolSuccess(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return toolError(error);
    }
    throw error;
  }
}
