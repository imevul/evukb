import {
  asCorpusId,
  asWorkspaceId,
  type CreateKnowledgeCorpusInput,
  defaultRankingStrategyId,
  type KnowledgeCorpus,
  resolveImportKind,
  resolveSyncIntervalMinutes,
  type UpdateKnowledgeCorpusInput,
} from '@evu/kb-core';
import { and, asc, eq, sql } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { knowledgeCorpora } from '../schema/knowledge.js';

function mapCorpusRow(row: typeof knowledgeCorpora.$inferSelect): KnowledgeCorpus {
  return {
    id: asCorpusId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    name: row.name,
    description: row.description,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    embeddingProviderId: row.embeddingProviderId,
    embeddingModelId: row.embeddingModelId,
    rankingStrategyId: row.rankingStrategyId,
    fileCount: row.fileCount,
    chunkCount: row.chunkCount,
    totalBytes: row.totalBytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class CorpusRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async create(input: CreateKnowledgeCorpusInput): Promise<KnowledgeCorpus> {
    const [row] = await this.#db
      .insert(knowledgeCorpora)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? '',
        settings: input.settings ?? {},
        rankingStrategyId: input.rankingStrategyId ?? defaultRankingStrategyId,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create knowledge corpus.');
    }

    return mapCorpusRow(row);
  }

  async getById(workspaceId: string, corpusId: string): Promise<KnowledgeCorpus | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeCorpora)
      .where(and(eq(knowledgeCorpora.workspaceId, workspaceId), eq(knowledgeCorpora.id, corpusId)))
      .limit(1);

    return row ? mapCorpusRow(row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<KnowledgeCorpus[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeCorpora)
      .where(eq(knowledgeCorpora.workspaceId, workspaceId))
      .orderBy(asc(knowledgeCorpora.createdAt));

    return rows.map(mapCorpusRow);
  }

  async update(
    workspaceId: string,
    corpusId: string,
    input: UpdateKnowledgeCorpusInput,
  ): Promise<KnowledgeCorpus | null> {
    const updates: Partial<typeof knowledgeCorpora.$inferInsert> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.settings !== undefined) {
      updates.settings = input.settings;
    }
    if (input.rankingStrategyId !== undefined) {
      updates.rankingStrategyId = input.rankingStrategyId;
    }

    const [row] = await this.#db
      .update(knowledgeCorpora)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(knowledgeCorpora.workspaceId, workspaceId), eq(knowledgeCorpora.id, corpusId)))
      .returning();

    return row ? mapCorpusRow(row) : null;
  }

  async delete(workspaceId: string, corpusId: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(knowledgeCorpora)
      .where(and(eq(knowledgeCorpora.workspaceId, workspaceId), eq(knowledgeCorpora.id, corpusId)))
      .returning({ id: knowledgeCorpora.id });

    return deleted.length > 0;
  }

  async refreshStats(
    workspaceId: string,
    corpusId: string,
    stats: { fileCount: number; chunkCount: number; totalBytes: number },
  ): Promise<KnowledgeCorpus | null> {
    const [row] = await this.#db
      .update(knowledgeCorpora)
      .set({
        fileCount: stats.fileCount,
        chunkCount: stats.chunkCount,
        totalBytes: stats.totalBytes,
        updatedAt: sql`now()`,
      })
      .where(and(eq(knowledgeCorpora.workspaceId, workspaceId), eq(knowledgeCorpora.id, corpusId)))
      .returning();

    return row ? mapCorpusRow(row) : null;
  }

  async listSyncEnabled(): Promise<KnowledgeCorpus[]> {
    const rows = await this.#db.select().from(knowledgeCorpora);
    return rows.map(mapCorpusRow).filter((corpus) => {
      const importKind = resolveImportKind(corpus.settings);
      if (importKind !== 'mount' && importKind !== 'git') {
        return false;
      }
      return resolveSyncIntervalMinutes(corpus.settings) !== null;
    });
  }
}
