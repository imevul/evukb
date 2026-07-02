import { type ApiKeyRecord, asWorkspaceId, type KbAuthScope } from '@evu/kb-core';
import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { apiKeys } from '../schema/auth.js';

function mapApiKeyRow(row: typeof apiKeys.$inferSelect): ApiKeyRecord {
  return {
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    name: row.name,
    scopes: (row.scopes ?? []) as KbAuthScope[],
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export type CreateApiKeyInput = {
  workspaceId: string;
  name: string;
  hash: string;
  scopes: KbAuthScope[];
  expiresAt?: string | null;
};

export class ApiKeyRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async create(input: CreateApiKeyInput): Promise<ApiKeyRecord> {
    const [row] = await this.#db
      .insert(apiKeys)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        hash: input.hash,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create API key.');
    }

    return mapApiKeyRow(row);
  }

  async listByWorkspace(workspaceId: string): Promise<ApiKeyRecord[]> {
    const rows = await this.#db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspaceId));
    return rows.map(mapApiKeyRow);
  }

  async findByHash(hash: string): Promise<ApiKeyRecord | null> {
    const [row] = await this.#db.select().from(apiKeys).where(eq(apiKeys.hash, hash)).limit(1);
    return row ? mapApiKeyRow(row) : null;
  }

  async getById(workspaceId: string, keyId: string): Promise<ApiKeyRecord | null> {
    const [row] = await this.#db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.workspaceId, workspaceId), eq(apiKeys.id, keyId)))
      .limit(1);
    return row ? mapApiKeyRow(row) : null;
  }

  async revoke(workspaceId: string, keyId: string): Promise<boolean> {
    const rows = await this.#db
      .delete(apiKeys)
      .where(and(eq(apiKeys.workspaceId, workspaceId), eq(apiKeys.id, keyId)))
      .returning({ id: apiKeys.id });
    return rows.length > 0;
  }
}
