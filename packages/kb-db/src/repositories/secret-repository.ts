import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { secrets } from '../schema/auth.js';

export type StoredSecret = {
  id: string;
  workspaceId: string;
  name: string;
  ciphertext: Buffer;
  nonce: Buffer;
  createdAt: string;
};

export type SecretMetadata = {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
};

function mapSecretRow(row: typeof secrets.$inferSelect): StoredSecret {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    ciphertext: Buffer.from(row.ciphertext),
    nonce: Buffer.from(row.nonce),
    createdAt: row.createdAt,
  };
}

function mapSecretMetadata(row: typeof secrets.$inferSelect): SecretMetadata {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt,
  };
}

export class SecretRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async getByName(workspaceId: string, name: string): Promise<StoredSecret | null> {
    const [row] = await this.#db
      .select()
      .from(secrets)
      .where(and(eq(secrets.workspaceId, workspaceId), eq(secrets.name, name)))
      .limit(1);

    return row ? mapSecretRow(row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<SecretMetadata[]> {
    const rows = await this.#db.select().from(secrets).where(eq(secrets.workspaceId, workspaceId));

    return rows.map(mapSecretMetadata);
  }

  async create(input: {
    workspaceId: string;
    name: string;
    ciphertext: Buffer;
    nonce: Buffer;
  }): Promise<SecretMetadata> {
    const [row] = await this.#db
      .insert(secrets)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        ciphertext: input.ciphertext,
        nonce: input.nonce,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create secret.');
    }

    return mapSecretMetadata(row);
  }

  async delete(workspaceId: string, secretId: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(secrets)
      .where(and(eq(secrets.workspaceId, workspaceId), eq(secrets.id, secretId)))
      .returning({ id: secrets.id });

    return deleted.length > 0;
  }

  async update(
    workspaceId: string,
    secretId: string,
    input: { ciphertext: Buffer; nonce: Buffer },
  ): Promise<SecretMetadata | null> {
    const [row] = await this.#db
      .update(secrets)
      .set({
        ciphertext: input.ciphertext,
        nonce: input.nonce,
      })
      .where(and(eq(secrets.workspaceId, workspaceId), eq(secrets.id, secretId)))
      .returning();

    return row ? mapSecretMetadata(row) : null;
  }
}
