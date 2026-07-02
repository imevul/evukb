import {
  asCorpusId,
  asNodeId,
  asWorkspaceId,
  type KnowledgeLink,
  type LinkKind,
} from '@evu/kb-core';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { knowledgeLinks } from '../schema/knowledge.js';

function mapLinkRow(row: typeof knowledgeLinks.$inferSelect): KnowledgeLink {
  return {
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    corpusId: asCorpusId(row.corpusId),
    fromNodeId: asNodeId(row.fromNodeId),
    toNodeId: row.toNodeId ? asNodeId(row.toNodeId) : null,
    linkKind: row.linkKind as LinkKind,
    raw: row.raw,
    targetPath: row.targetPath,
    externalUrl: row.externalUrl,
    resolved: row.resolved,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

export type CreateLinkInput = {
  workspaceId: string;
  corpusId: string;
  fromNodeId: string;
  toNodeId?: string | null;
  linkKind: LinkKind;
  raw: string;
  targetPath?: string | null;
  externalUrl?: string | null;
  resolved?: boolean;
  metadata?: Record<string, unknown>;
};

export type LinkResolutionCounts = {
  total: number;
  internal: number;
  resolved: number;
  unresolved: number;
};

export type LinkResolutionUpdate = {
  id: string;
  toNodeId: string | null;
  resolved: boolean;
};

export class LinkRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async replaceForNode(
    workspaceId: string,
    corpusId: string,
    fromNodeId: string,
    links: CreateLinkInput[],
  ): Promise<KnowledgeLink[]> {
    await this.#db
      .delete(knowledgeLinks)
      .where(
        and(
          eq(knowledgeLinks.workspaceId, workspaceId),
          eq(knowledgeLinks.corpusId, corpusId),
          eq(knowledgeLinks.fromNodeId, fromNodeId),
        ),
      );

    if (links.length === 0) {
      return [];
    }

    const rows = await this.#db
      .insert(knowledgeLinks)
      .values(
        links.map((link) => ({
          workspaceId: link.workspaceId,
          corpusId: link.corpusId,
          fromNodeId: link.fromNodeId,
          toNodeId: link.toNodeId ?? null,
          linkKind: link.linkKind,
          raw: link.raw,
          targetPath: link.targetPath ?? null,
          externalUrl: link.externalUrl ?? null,
          resolved: link.resolved ?? false,
          metadata: link.metadata ?? {},
        })),
      )
      .returning();

    return rows.map(mapLinkRow);
  }

  async listByCorpus(workspaceId: string, corpusId: string): Promise<KnowledgeLink[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeLinks)
      .where(
        and(eq(knowledgeLinks.workspaceId, workspaceId), eq(knowledgeLinks.corpusId, corpusId)),
      );
    return rows.map(mapLinkRow);
  }

  async listByNode(
    workspaceId: string,
    corpusId: string,
    fromNodeId: string,
  ): Promise<KnowledgeLink[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeLinks)
      .where(
        and(
          eq(knowledgeLinks.workspaceId, workspaceId),
          eq(knowledgeLinks.corpusId, corpusId),
          eq(knowledgeLinks.fromNodeId, fromNodeId),
        ),
      );
    return rows.map(mapLinkRow);
  }

  async resolveIncomingTargets(
    workspaceId: string,
    corpusId: string,
    targetPaths: string[],
    toNodeId: string,
  ): Promise<number> {
    if (targetPaths.length === 0) {
      return 0;
    }

    const rows = await this.#db
      .update(knowledgeLinks)
      .set({
        toNodeId,
        resolved: true,
      })
      .where(
        and(
          eq(knowledgeLinks.workspaceId, workspaceId),
          eq(knowledgeLinks.corpusId, corpusId),
          isNull(knowledgeLinks.externalUrl),
          inArray(knowledgeLinks.targetPath, targetPaths),
        ),
      )
      .returning({ id: knowledgeLinks.id });

    return rows.length;
  }

  async updateResolutionBatch(
    workspaceId: string,
    corpusId: string,
    updates: LinkResolutionUpdate[],
  ): Promise<void> {
    for (const update of updates) {
      await this.#db
        .update(knowledgeLinks)
        .set({
          toNodeId: update.toNodeId,
          resolved: update.resolved,
        })
        .where(
          and(
            eq(knowledgeLinks.workspaceId, workspaceId),
            eq(knowledgeLinks.corpusId, corpusId),
            eq(knowledgeLinks.id, update.id),
          ),
        );
    }
  }

  async countByResolution(workspaceId: string, corpusId: string): Promise<LinkResolutionCounts> {
    const [row] = await this.#db
      .select({
        total: sql<number>`count(*)::int`,
        internal: sql<number>`count(*) filter (where ${knowledgeLinks.externalUrl} is null)::int`,
        resolved: sql<number>`count(*) filter (where ${knowledgeLinks.externalUrl} is null and ${knowledgeLinks.resolved} = true)::int`,
        unresolved: sql<number>`count(*) filter (where ${knowledgeLinks.externalUrl} is null and ${knowledgeLinks.resolved} = false)::int`,
      })
      .from(knowledgeLinks)
      .where(
        and(eq(knowledgeLinks.workspaceId, workspaceId), eq(knowledgeLinks.corpusId, corpusId)),
      );

    return {
      total: row?.total ?? 0,
      internal: row?.internal ?? 0,
      resolved: row?.resolved ?? 0,
      unresolved: row?.unresolved ?? 0,
    };
  }
}
