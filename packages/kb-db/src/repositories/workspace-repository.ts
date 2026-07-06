import { asUserId, asWorkspaceId, type CreateWorkspaceInput, type Workspace } from '@evu/kb-core';
import { eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { workspaceMembers } from '../schema/workspace-members.js';
import { workspaces } from '../schema/workspaces.js';

function mapWorkspaceRow(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: asWorkspaceId(row.id),
    slug: row.slug,
    name: row.name,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

export class WorkspaceRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const [row] = await this.#db
      .insert(workspaces)
      .values({
        slug: input.slug,
        name: input.name,
        settings: input.settings ?? {},
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create workspace.');
    }

    return mapWorkspaceRow(row);
  }

  async getById(workspaceId: string): Promise<Workspace | null> {
    const [row] = await this.#db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return row ? mapWorkspaceRow(row) : null;
  }

  async getBySlug(slug: string): Promise<Workspace | null> {
    const [row] = await this.#db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);
    return row ? mapWorkspaceRow(row) : null;
  }

  async list(): Promise<Workspace[]> {
    const rows = await this.#db.select().from(workspaces);
    return rows.map(mapWorkspaceRow);
  }

  async update(
    workspaceId: string,
    input: { name?: string; settings?: Record<string, unknown> },
  ): Promise<Workspace | null> {
    const updates: Partial<typeof workspaces.$inferInsert> = {};
    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.settings !== undefined) {
      updates.settings = input.settings;
    }

    const [row] = await this.#db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return row ? mapWorkspaceRow(row) : null;
  }

  async delete(workspaceId: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .returning({ id: workspaces.id });
    return deleted.length > 0;
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: string,
  ): Promise<{ workspaceId: string; userId: string; role: string }> {
    const [row] = await this.#db
      .insert(workspaceMembers)
      .values({
        workspaceId,
        userId,
        role,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to add workspace member.');
    }

    return {
      workspaceId: asWorkspaceId(row.workspaceId),
      userId: asUserId(row.userId),
      role: row.role,
    };
  }
}
