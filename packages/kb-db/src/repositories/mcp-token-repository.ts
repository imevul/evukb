import { asWorkspaceId, type KbAuthScope, type McpTokenRecord } from '@evu/kb-core';
import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { mcpTokens } from '../schema/auth.js';

function mapMcpTokenRow(row: typeof mcpTokens.$inferSelect): McpTokenRecord {
  return {
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    name: row.name,
    scopes: (row.scopes ?? []) as KbAuthScope[],
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export type CreateMcpTokenInput = {
  workspaceId: string;
  name: string;
  hash: string;
  scopes: KbAuthScope[];
  expiresAt?: string | null;
};

export class McpTokenRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async create(input: CreateMcpTokenInput): Promise<McpTokenRecord> {
    const [row] = await this.#db
      .insert(mcpTokens)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        hash: input.hash,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create MCP token.');
    }

    return mapMcpTokenRow(row);
  }

  async listByWorkspace(workspaceId: string): Promise<McpTokenRecord[]> {
    const rows = await this.#db
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.workspaceId, workspaceId));
    return rows.map(mapMcpTokenRow);
  }

  async findByHash(hash: string): Promise<McpTokenRecord | null> {
    const [row] = await this.#db.select().from(mcpTokens).where(eq(mcpTokens.hash, hash)).limit(1);
    return row ? mapMcpTokenRow(row) : null;
  }

  async getById(workspaceId: string, tokenId: string): Promise<McpTokenRecord | null> {
    const [row] = await this.#db
      .select()
      .from(mcpTokens)
      .where(and(eq(mcpTokens.workspaceId, workspaceId), eq(mcpTokens.id, tokenId)))
      .limit(1);
    return row ? mapMcpTokenRow(row) : null;
  }

  async revoke(workspaceId: string, tokenId: string): Promise<boolean> {
    const rows = await this.#db
      .delete(mcpTokens)
      .where(and(eq(mcpTokens.workspaceId, workspaceId), eq(mcpTokens.id, tokenId)))
      .returning({ id: mcpTokens.id });
    return rows.length > 0;
  }
}
