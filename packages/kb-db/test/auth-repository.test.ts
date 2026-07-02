import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ApiKeyRepository,
  createDb,
  McpTokenRepository,
  migrateLatest,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

function hashTokenSecret(plaintext: string): string {
  const pepper = process.env.EVUKB_TOKEN_PEPPER ?? '';
  return createHash('sha256').update(`${pepper}${plaintext}`).digest('hex');
}

describeIfDb('auth repositories', () => {
  it('scopes MCP token reads and revokes to workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const mcpTokens = new McpTokenRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const token = await mcpTokens.create({
        workspaceId: workspaceA.id,
        name: 'Agent token',
        hash: hashTokenSecret(`evukb_mcp_${randomUUID()}`),
        scopes: ['kb:read'],
      });

      await expect(mcpTokens.listByWorkspace(workspaceA.id)).resolves.toHaveLength(1);
      await expect(mcpTokens.listByWorkspace(workspaceB.id)).resolves.toEqual([]);
      await expect(mcpTokens.revoke(workspaceB.id, token.id)).resolves.toBe(false);
      await expect(mcpTokens.revoke(workspaceA.id, token.id)).resolves.toBe(true);
      await expect(mcpTokens.listByWorkspace(workspaceA.id)).resolves.toEqual([]);
    } finally {
      await handle.close();
    }
  });

  it('scopes API key reads and revokes to workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const apiKeys = new ApiKeyRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const key = await apiKeys.create({
        workspaceId: workspaceA.id,
        name: 'Automation key',
        hash: hashTokenSecret(`evukb_api_${randomUUID()}`),
        scopes: ['kb:read'],
      });

      await expect(apiKeys.listByWorkspace(workspaceA.id)).resolves.toHaveLength(1);
      await expect(apiKeys.listByWorkspace(workspaceB.id)).resolves.toEqual([]);
      await expect(apiKeys.revoke(workspaceB.id, key.id)).resolves.toBe(false);
      await expect(apiKeys.revoke(workspaceA.id, key.id)).resolves.toBe(true);
      await expect(apiKeys.listByWorkspace(workspaceA.id)).resolves.toEqual([]);
    } finally {
      await handle.close();
    }
  });

  it('finds tokens by hash globally for auth lookup', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const mcpTokens = new McpTokenRepository(handle);

      const workspace = await workspaces.create({
        slug: `ws-${randomUUID()}`,
        name: 'Auth Workspace',
      });
      const plaintext = `evukb_mcp_${randomUUID()}`;
      const hash = hashTokenSecret(plaintext);

      await mcpTokens.create({
        workspaceId: workspace.id,
        name: 'Lookup token',
        hash,
        scopes: ['kb:read'],
      });

      await expect(mcpTokens.findByHash(hash)).resolves.toMatchObject({
        workspaceId: workspace.id,
        name: 'Lookup token',
      });
      await expect(mcpTokens.findByHash(hashTokenSecret('evukb_mcp_missing'))).resolves.toBeNull();
    } finally {
      await handle.close();
    }
  });
});
