import { AsyncLocalStorage } from 'node:async_hooks';

import type { KbAuthScope } from '@evu/kb-core';

export type McpAuthKind = 'db' | 'dev' | 'open';

export type McpRequestAuth = {
  kind: McpAuthKind;
  workspaceId?: string;
  scopes?: KbAuthScope[];
  tokenId?: string;
};

const mcpRequestAuthStorage = new AsyncLocalStorage<McpRequestAuth>();

export function runWithMcpAuth<T>(auth: McpRequestAuth, fn: () => T | Promise<T>): T | Promise<T> {
  return mcpRequestAuthStorage.run(auth, fn);
}

export function getMcpRequestAuth(): McpRequestAuth | undefined {
  return mcpRequestAuthStorage.getStore();
}
