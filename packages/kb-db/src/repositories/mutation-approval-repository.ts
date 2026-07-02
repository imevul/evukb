import {
  defaultMutationApprovalListLimit,
  type KbWriteActor,
  type KbWriteToolRequest,
  type MutationApprovalPreview,
  type MutationApprovalRecord,
  maxMutationApprovalListLimit,
} from '@evu/kb-core';
import { and, desc, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { mutationApprovalRequests } from '../schema/approvals.js';

export type CreatePendingApprovalInput = {
  workspaceId: string;
  corpusId: string;
  action: string;
  request: KbWriteToolRequest;
  actor: KbWriteActor;
  preview: MutationApprovalPreview;
};

function mapRow(row: typeof mutationApprovalRequests.$inferSelect): MutationApprovalRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    corpusId: row.corpusId,
    status: row.status as MutationApprovalRecord['status'],
    action: row.action,
    request: row.request as KbWriteToolRequest,
    actor: row.actor as KbWriteActor,
    preview: row.preview as MutationApprovalPreview,
    decidedBy: (row.decidedBy as KbWriteActor | null) ?? null,
    decidedAt: row.decidedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) {
    return defaultMutationApprovalListLimit;
  }
  if (!Number.isFinite(limit) || limit < 1) {
    return defaultMutationApprovalListLimit;
  }
  return Math.min(Math.floor(limit), maxMutationApprovalListLimit);
}

export class MutationApprovalRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async createPending(input: CreatePendingApprovalInput): Promise<MutationApprovalRecord> {
    const rows = await this.#db
      .insert(mutationApprovalRequests)
      .values({
        workspaceId: input.workspaceId,
        corpusId: input.corpusId,
        status: 'pending',
        action: input.action,
        request: input.request,
        actor: input.actor,
        preview: input.preview,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to create mutation approval request.');
    }
    return mapRow(row);
  }

  async getByIdInWorkspace(
    workspaceId: string,
    approvalId: string,
  ): Promise<MutationApprovalRecord | null> {
    const rows = await this.#db
      .select()
      .from(mutationApprovalRequests)
      .where(
        and(
          eq(mutationApprovalRequests.workspaceId, workspaceId),
          eq(mutationApprovalRequests.id, approvalId),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async listPending(workspaceId: string, limit?: number): Promise<MutationApprovalRecord[]> {
    const rows = await this.#db
      .select()
      .from(mutationApprovalRequests)
      .where(
        and(
          eq(mutationApprovalRequests.workspaceId, workspaceId),
          eq(mutationApprovalRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(mutationApprovalRequests.createdAt))
      .limit(normalizeLimit(limit));

    return rows.map(mapRow);
  }

  async markRejected(
    workspaceId: string,
    approvalId: string,
    decidedBy: KbWriteActor,
  ): Promise<MutationApprovalRecord | null> {
    const rows = await this.#db
      .update(mutationApprovalRequests)
      .set({
        status: 'rejected',
        decidedBy,
        decidedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(mutationApprovalRequests.workspaceId, workspaceId),
          eq(mutationApprovalRequests.id, approvalId),
          eq(mutationApprovalRequests.status, 'pending'),
        ),
      )
      .returning();

    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async markApplied(
    workspaceId: string,
    approvalId: string,
    decidedBy: KbWriteActor,
  ): Promise<MutationApprovalRecord | null> {
    const rows = await this.#db
      .update(mutationApprovalRequests)
      .set({
        status: 'applied',
        decidedBy,
        decidedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(mutationApprovalRequests.workspaceId, workspaceId),
          eq(mutationApprovalRequests.id, approvalId),
          eq(mutationApprovalRequests.status, 'pending'),
        ),
      )
      .returning();

    const row = rows[0];
    return row ? mapRow(row) : null;
  }
}
