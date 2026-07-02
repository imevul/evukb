import type {
  ChatCompletionInput,
  ChatCompletionResult,
  ChatCompletionStreamEvent,
  ChatProvider,
  KbAuthScope,
} from '@evu/kb-core';
import { describe, expect, vi } from 'vitest';

import { type createEvuKbServer, waitForJobIdle } from '../../src/index.js';

export type TestServer = Awaited<ReturnType<typeof createEvuKbServer>>;

export const databaseUrl = process.env.EVUKB_DATABASE_URL;
export const describeIfDb = databaseUrl ? describe : describe.skip;

if (databaseUrl) {
  vi.setConfig({ testTimeout: 60_000 });
}

export function createStubChatProvider(): ChatProvider {
  async function buildAnswer(input: ChatCompletionInput): Promise<string> {
    const userMessage = input.messages.find((message) => message.role === 'user')?.content ?? '';
    return userMessage.includes('alpha fixture')
      ? 'The corpus mentions an alpha fixture [1].'
      : 'No matching context.';
  }

  return {
    model: 'integration-mock',
    async health() {
      return { status: 'ok', model: 'integration-mock' };
    },
    async complete(input: ChatCompletionInput): Promise<ChatCompletionResult> {
      return { content: await buildAnswer(input) };
    },
    async *completeStream(input: ChatCompletionInput): AsyncIterable<ChatCompletionStreamEvent> {
      const content = await buildAnswer(input);
      for (const token of content.split(' ')) {
        yield { type: 'token', delta: `${token} ` };
      }
      yield { type: 'done' };
    },
  };
}

export function createRerankChatProvider(): ChatProvider {
  return {
    model: 'rerank-mock',
    async health() {
      return { status: 'ok', model: 'rerank-mock' };
    },
    async complete(input: ChatCompletionInput): Promise<ChatCompletionResult> {
      const userMessage = input.messages.find((message) => message.role === 'user')?.content ?? '';
      if (userMessage.includes('Candidates:')) {
        const chunkIds = [...userMessage.matchAll(/chunkId=([^\s\n]+)/g)].map((match) => match[1]);
        return { content: JSON.stringify([...chunkIds].reverse()) };
      }
      return { content: 'The corpus discusses rerank fixture topics [1].' };
    },
    async *completeStream(): AsyncIterable<ChatCompletionStreamEvent> {
      yield { type: 'done' };
    },
  };
}

export function requireDatabaseUrl(): string {
  if (!databaseUrl) {
    throw new Error('EVUKB_DATABASE_URL is required for integration tests.');
  }
  return databaseUrl;
}

export async function createTestApiKey(
  workspaceId: string,
  name: string,
  scopes: KbAuthScope[],
): Promise<string> {
  const { createDb, migrateLatest, ApiKeyRepository } = await import('@evu/kb-db');
  const { generateApiKeySecret, hashTokenSecret } = await import('../../src/auth/token-hash.js');
  const handle = createDb({ connectionString: requireDatabaseUrl() });
  try {
    await migrateLatest(handle);
    const plain = generateApiKeySecret();
    await new ApiKeyRepository(handle).create({
      workspaceId,
      name,
      hash: hashTokenSecret(plain),
      scopes,
      expiresAt: null,
    });
    return plain;
  } finally {
    await handle.close();
  }
}

export async function waitForBackgroundJobs(server: TestServer, timeoutMs = 20_000): Promise<void> {
  await waitForJobIdle(server.evuKbRuntime?.jobQueue, timeoutMs);
}

export async function waitForNodeIndexed(
  server: TestServer,
  workspaceId: string,
  corpusId: string,
  nodeId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const nodesResponse = await server.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/knowledge-corpora/${corpusId}/nodes?format=flat`,
    });
    const node = nodesResponse.json().find((entry: { id: string }) => entry.id === nodeId);
    if (node?.indexStatus === 'indexed') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for node ${nodeId} to become indexed.`);
}

export async function waitForNodeIndexedViaJobs(
  server: TestServer,
  workspaceId: string,
  corpusId: string,
  nodeId: string,
): Promise<void> {
  await waitForBackgroundJobs(server);
  await waitForNodeIndexed(server, workspaceId, corpusId, nodeId);
}

export const mcpAccept = 'application/json, text/event-stream';

export async function callMcpTool(
  server: TestServer,
  toolName: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await server.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      accept: mcpAccept,
      'content-type': 'application/json',
      ...headers,
    },
    payload: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
  });
  return response;
}

export function parseMcpToolResult(response: { statusCode: number; body: string }) {
  expect(response.statusCode).toBe(200);
  const payload = JSON.parse(response.body) as {
    result?: { structuredContent?: unknown; isError?: boolean };
  };
  return payload.result;
}
