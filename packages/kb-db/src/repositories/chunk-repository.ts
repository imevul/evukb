import {
  asChunkId,
  asCorpusId,
  asNodeId,
  asWorkspaceId,
  filtersNeedSqlJoin,
  globPatternToSqlLike,
  hasGlobWildcards,
  hasKnowledgeFilters,
  type KnowledgeChunk,
  type KnowledgeFilters,
} from '@evu/kb-core';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { knowledgeChunks } from '../schema/knowledge.js';

function mapChunkRowFromSql(row: Record<string, unknown>): KnowledgeChunk {
  return {
    id: asChunkId(String(row.id)),
    workspaceId: asWorkspaceId(String(row.workspace_id ?? row.workspaceId)),
    corpusId: asCorpusId(String(row.corpus_id ?? row.corpusId)),
    nodeId: asNodeId(String(row.node_id ?? row.nodeId)),
    ordinal: Number(row.ordinal),
    filePath: String(row.file_path ?? row.filePath),
    folderPath: String(row.folder_path ?? row.folderPath ?? ''),
    headingPath: (row.heading_path ?? row.headingPath ?? []) as string[],
    body: String(row.body),
    bodyPreview: String(row.body_preview ?? row.bodyPreview ?? ''),
    tokenCount: Number(row.token_count ?? row.tokenCount ?? 0),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    indexedAt: String(row.indexed_at ?? row.indexedAt),
  };
}

function mapChunkRow(row: typeof knowledgeChunks.$inferSelect): KnowledgeChunk {
  return mapChunkRowFromSql(row as unknown as Record<string, unknown>);
}

export type CreateChunkInput = {
  workspaceId: string;
  corpusId: string;
  nodeId: string;
  ordinal: number;
  filePath: string;
  folderPath: string;
  headingPath: string[];
  body: string;
  bodyPreview: string;
  tokenCount: number;
  embedding?: number[] | null;
  metadata?: Record<string, unknown>;
};

export type KeywordSearchHit = KnowledgeChunk & {
  keywordScore: number;
};

export type SemanticSearchHit = KnowledgeChunk & {
  semanticScore: number;
};

function normalizePathPrefix(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function buildKeywordNodeFilterSql(filters: KnowledgeFilters | undefined): ReturnType<typeof sql> {
  if (!hasKnowledgeFilters(filters)) {
    return sql``;
  }

  const clauses: ReturnType<typeof sql>[] = [];

  if (filters.pathAllowlist && filters.pathAllowlist.length > 0) {
    const pathClauses = filters.pathAllowlist.map((prefix) => {
      const normalized = normalizePathPrefix(prefix);
      return sql`(c.file_path = ${normalized} OR c.file_path LIKE ${`${normalized}/%`})`;
    });
    clauses.push(sql`(${sql.join(pathClauses, sql` OR `)})`);
  }

  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    clauses.push(
      sql`n.source_type IN (${sql.join(
        filters.sourceTypes.map((sourceType) => sql`${sourceType}`),
        sql`, `,
      )})`,
    );
  }

  if (filters.indexStatus && filters.indexStatus.length > 0) {
    clauses.push(
      sql`n.index_status IN (${sql.join(
        filters.indexStatus.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    );
  }

  if (filters.okfType) {
    clauses.push(sql`lower(n.metadata->'frontmatter'->>'type') = ${filters.okfType.toLowerCase()}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    const tagClauses = filters.tags.map(
      (tag) =>
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(n.metadata->'frontmatter'->'tags', '[]'::jsonb)) AS tag(value)
          WHERE lower(tag.value) = ${tag.toLowerCase()}
        )`,
    );
    clauses.push(sql`(${sql.join(tagClauses, sql` OR `)})`);
  }

  if (filters.frontmatter && Object.keys(filters.frontmatter).length > 0) {
    for (const [key, value] of Object.entries(filters.frontmatter)) {
      if (hasGlobWildcards(value)) {
        clauses.push(
          sql`n.metadata->'frontmatter'->>${key} ILIKE ${globPatternToSqlLike(value)} ESCAPE '\\'`,
        );
      } else {
        clauses.push(sql`lower(n.metadata->'frontmatter'->>${key}) = ${value.toLowerCase()}`);
      }
    }
  }

  if (clauses.length === 0) {
    return sql``;
  }

  return sql`AND ${sql.join(clauses, sql` AND `)}`;
}

export class ChunkRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async replaceForNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    chunks: CreateChunkInput[],
  ): Promise<KnowledgeChunk[]> {
    await this.#db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          eq(knowledgeChunks.corpusId, corpusId),
          eq(knowledgeChunks.nodeId, nodeId),
        ),
      );

    if (chunks.length === 0) {
      return [];
    }

    const rows = await this.#db
      .insert(knowledgeChunks)
      .values(
        chunks.map((chunk) => ({
          workspaceId: chunk.workspaceId,
          corpusId: chunk.corpusId,
          nodeId: chunk.nodeId,
          ordinal: chunk.ordinal,
          filePath: chunk.filePath,
          folderPath: chunk.folderPath,
          headingPath: chunk.headingPath,
          body: chunk.body,
          bodyPreview: chunk.bodyPreview,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding ?? null,
          metadata: chunk.metadata ?? {},
        })),
      )
      .returning();

    return rows.map(mapChunkRow);
  }

  async listIdsByNode(workspaceId: string, corpusId: string, nodeId: string): Promise<string[]> {
    const rows = await this.#db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          eq(knowledgeChunks.corpusId, corpusId),
          eq(knowledgeChunks.nodeId, nodeId),
        ),
      );
    return rows.map((row) => row.id);
  }

  async updateExternalVectorIds(
    workspaceId: string,
    corpusId: string,
    updates: Array<{ chunkId: string; externalVectorId: string | null }>,
  ): Promise<void> {
    for (const update of updates) {
      await this.#db
        .update(knowledgeChunks)
        .set({ externalVectorId: update.externalVectorId })
        .where(
          and(
            eq(knowledgeChunks.workspaceId, workspaceId),
            eq(knowledgeChunks.corpusId, corpusId),
            eq(knowledgeChunks.id, update.chunkId),
          ),
        );
    }
  }

  async deleteForNode(workspaceId: string, corpusId: string, nodeId: string): Promise<void> {
    await this.#db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          eq(knowledgeChunks.corpusId, corpusId),
          eq(knowledgeChunks.nodeId, nodeId),
        ),
      );
  }

  async listByCorpus(workspaceId: string, corpusId: string): Promise<KnowledgeChunk[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeChunks)
      .where(
        and(eq(knowledgeChunks.workspaceId, workspaceId), eq(knowledgeChunks.corpusId, corpusId)),
      );
    return rows.map(mapChunkRow);
  }

  async countByCorpus(workspaceId: string, corpusId: string): Promise<number> {
    const result = await this.#db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeChunks)
      .where(
        and(eq(knowledgeChunks.workspaceId, workspaceId), eq(knowledgeChunks.corpusId, corpusId)),
      );
    return result[0]?.count ?? 0;
  }

  async getById(
    workspaceId: string,
    corpusId: string,
    chunkId: string,
  ): Promise<KnowledgeChunk | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          eq(knowledgeChunks.corpusId, corpusId),
          eq(knowledgeChunks.id, chunkId),
        ),
      )
      .limit(1);
    return row ? mapChunkRow(row) : null;
  }

  async searchKeyword(
    workspaceId: string,
    corpusId: string,
    query: string,
    options: { pathPrefix?: string; limit?: number; filters?: KnowledgeFilters } = {},
  ): Promise<KeywordSearchHit[]> {
    const limit = options.limit ?? 20;
    const pathPrefix = options.pathPrefix?.trim();
    const nodeFilter = buildKeywordNodeFilterSql(options.filters);
    const needsJoin = filtersNeedSqlJoin(options.filters);
    const pathFilter = pathPrefix
      ? needsJoin
        ? sql`AND c.file_path LIKE ${`${pathPrefix}%`}`
        : sql`AND file_path LIKE ${`${pathPrefix}%`}`
      : sql``;

    const result = needsJoin
      ? await this.#db.execute(sql`
          SELECT
            c.id,
            c.workspace_id,
            c.corpus_id,
            c.node_id,
            c.ordinal,
            c.file_path,
            c.folder_path,
            c.heading_path,
            c.body,
            c.body_preview,
            c.token_count,
            c.metadata,
            c.indexed_at,
            ts_rank(c.search_vector, plainto_tsquery('english', ${query})) AS keyword_score
          FROM knowledge_chunks c
          INNER JOIN knowledge_nodes n
            ON n.id = c.node_id
            AND n.workspace_id = c.workspace_id
            AND n.corpus_id = c.corpus_id
          WHERE c.workspace_id = ${workspaceId}
            AND c.corpus_id = ${corpusId}
            AND c.search_vector @@ plainto_tsquery('english', ${query})
            ${pathFilter}
            ${nodeFilter}
          ORDER BY keyword_score DESC
          LIMIT ${limit}
        `)
      : await this.#db.execute(sql`
          SELECT
            id,
            workspace_id,
            corpus_id,
            node_id,
            ordinal,
            file_path,
            folder_path,
            heading_path,
            body,
            body_preview,
            token_count,
            metadata,
            indexed_at,
            ts_rank(search_vector, plainto_tsquery('english', ${query})) AS keyword_score
          FROM knowledge_chunks
          WHERE workspace_id = ${workspaceId}
            AND corpus_id = ${corpusId}
            AND search_vector @@ plainto_tsquery('english', ${query})
            ${pathFilter}
          ORDER BY keyword_score DESC
          LIMIT ${limit}
        `);

    return result.rows.map((row) => ({
      ...mapChunkRowFromSql(row as Record<string, unknown>),
      keywordScore: Number((row as { keyword_score: string | number }).keyword_score ?? 0),
    }));
  }

  async searchSemantic(
    workspaceId: string,
    corpusIds: string | string[],
    embedding: number[],
    options: { pathPrefix?: string; limit?: number } = {},
  ): Promise<SemanticSearchHit[]> {
    const corpusIdList = (Array.isArray(corpusIds) ? corpusIds : [corpusIds]).filter(Boolean);
    if (corpusIdList.length === 0) {
      return [];
    }

    const limit = options.limit ?? 20;
    const pathPrefix = options.pathPrefix?.trim();
    const pathFilter = pathPrefix
      ? sql`AND ${knowledgeChunks.filePath} LIKE ${`${pathPrefix}%`}`
      : sql``;
    const vectorLiteral = `[${embedding.join(',')}]`;
    const corpusFilter = sql`corpus_id IN (${sql.join(
      corpusIdList.map((corpusId) => sql`${corpusId}`),
      sql`, `,
    )})`;

    const result = await this.#db.execute(sql`
      SELECT
        id,
        workspace_id,
        corpus_id,
        node_id,
        ordinal,
        file_path,
        folder_path,
        heading_path,
        body,
        body_preview,
        token_count,
        metadata,
        indexed_at,
        1 - (embedding <=> ${vectorLiteral}::vector) AS semantic_score
      FROM knowledge_chunks
      WHERE workspace_id = ${workspaceId}
        AND ${corpusFilter}
        AND embedding IS NOT NULL
        ${pathFilter}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);

    return result.rows.map((row) => ({
      ...mapChunkRowFromSql(row as Record<string, unknown>),
      semanticScore: Number((row as { semantic_score: string | number }).semantic_score ?? 0),
    }));
  }

  async listByIds(
    workspaceId: string,
    corpusId: string,
    chunkIds: string[],
  ): Promise<KnowledgeChunk[]> {
    if (chunkIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          eq(knowledgeChunks.corpusId, corpusId),
          inArray(knowledgeChunks.id, chunkIds),
        ),
      );
    return rows.map(mapChunkRow);
  }
}
