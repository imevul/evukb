import {
  type AuditLogEntry,
  asWorkspaceId,
  defaultAuditLogLimit,
  maxAuditLogLimit,
} from '@evu/kb-core';
import { and, desc, eq } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { auditLog } from '../schema/auth.js';

export type AuditLogActor = Record<string, unknown>;

export type AuditLogTarget = Record<string, unknown>;

export type RecordAuditLogInput = {
  workspaceId: string;
  action: string;
  actor: AuditLogActor;
  target?: AuditLogTarget;
  metadata?: Record<string, unknown>;
};

export type ListAuditLogInput = {
  limit?: number;
  action?: string;
};

function mapAuditLogRow(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    action: row.action,
    actor: (row.actor ?? {}) as AuditLogEntry['actor'],
    target: (row.target ?? null) as AuditLogEntry['target'],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) {
    return defaultAuditLogLimit;
  }
  if (!Number.isFinite(limit) || limit < 1) {
    return defaultAuditLogLimit;
  }
  return Math.min(Math.floor(limit), maxAuditLogLimit);
}

export class AuditLogRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.#db.insert(auditLog).values({
      workspaceId: input.workspaceId,
      action: input.action,
      actor: input.actor,
      target: input.target ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async listByWorkspace(
    workspaceId: string,
    query: ListAuditLogInput = {},
  ): Promise<AuditLogEntry[]> {
    const limit = normalizeLimit(query.limit);
    const conditions = [eq(auditLog.workspaceId, workspaceId)];
    if (query.action) {
      conditions.push(eq(auditLog.action, query.action));
    }

    const rows = await this.#db
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    return rows.map(mapAuditLogRow);
  }
}
