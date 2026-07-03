import { asWorkspaceId, type ApiKeyRecord, type KbAuthScope } from '@evu/kb-core';
import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { apiKeys } from '../schema/auth.js';

function mapWritePathPrefixes(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const prefixes = raw.filter((item): item is string => typeof item === 'string');
  return prefixes.length > 0 ? prefixes : null;
}

function mapApiKeyRow(row: typeof apiKeys.$inferSelect): ApiKeyRecord {
  return {
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    name: row.name,
    scopes: (row.scopes ?? []) as KbAuthScope[],
    writePathPrefixes: mapWritePathPrefixes(row.writePathPrefixes),
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export type CreateApiKeyInput = {
  workspaceId: string;
  name: string;
  hash: string;
  scopes: KbAuthScope[];
  writePathPrefixes?: string[] | null;
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
        writePathPrefixes: input.writePathPrefixes ?? null,
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
