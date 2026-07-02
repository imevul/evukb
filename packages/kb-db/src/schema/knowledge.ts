import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, id, ts, updatedAt, vector1536, workspaceId } from './_helpers.js';

export const knowledgeCorpora = pgTable(
  'knowledge_corpora',
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    settings: jsonb('settings').notNull().default({}),
    embeddingProviderId: uuid('embedding_provider_id'),
    embeddingModelId: text('embedding_model_id'),
    rankingStrategyId: text('ranking_strategy_id').notNull().default('hybrid_default_v1'),
    fileCount: integer('file_count').notNull().default(0),
    chunkCount: integer('chunk_count').notNull().default(0),
    totalBytes: integer('total_bytes').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    workspaceNameUnique: uniqueIndex('knowledge_corpora_workspace_name_uq').on(
      table.workspaceId,
      table.name,
    ),
    workspaceIdx: index('knowledge_corpora_workspace_idx').on(table.workspaceId),
  }),
);

export const knowledgeNodes = pgTable(
  'knowledge_nodes',
  {
    id: id(),
    workspaceId: workspaceId(),
    corpusId: uuid('corpus_id').notNull(),
    parentId: uuid('parent_id'),
    path: text('path').notNull().default(''),
    name: text('name').notNull(),
    nodeType: text('node_type').notNull(),
    storageRelPath: text('storage_rel_path'),
    sourceType: text('source_type').notNull().default('managed'),
    sourceRef: text('source_ref'),
    contentHash: text('content_hash'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    indexStatus: text('index_status').notNull().default('pending'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    indexedAt: ts('indexed_at'),
  },
  (table) => ({
    workspaceCorpusIdx: index('knowledge_nodes_workspace_corpus_idx').on(
      table.workspaceId,
      table.corpusId,
    ),
    corpusIdx: index('knowledge_nodes_corpus_idx').on(table.corpusId),
    parentIdx: index('knowledge_nodes_parent_idx').on(table.parentId),
    corpusPathFileUnique: uniqueIndex('knowledge_nodes_corpus_path_uq')
      .on(table.corpusId, table.path, table.name)
      .where(sql`${table.nodeType} = 'file'`),
  }),
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: id(),
    workspaceId: workspaceId(),
    corpusId: uuid('corpus_id').notNull(),
    nodeId: uuid('node_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    filePath: text('file_path').notNull(),
    folderPath: text('folder_path').notNull().default(''),
    headingPath: jsonb('heading_path').notNull().default([]),
    body: text('body').notNull(),
    bodyPreview: text('body_preview').notNull().default(''),
    tokenCount: integer('token_count').notNull().default(0),
    embedding: vector1536('embedding'),
    externalVectorId: text('external_vector_id'),
    metadata: jsonb('metadata').notNull().default({}),
    indexedAt: ts('indexed_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceCorpusIdx: index('knowledge_chunks_workspace_corpus_idx').on(
      table.workspaceId,
      table.corpusId,
    ),
    corpusIdx: index('knowledge_chunks_corpus_idx').on(table.corpusId),
    nodeIdx: index('knowledge_chunks_node_idx').on(table.nodeId),
  }),
);

export const knowledgeLinks = pgTable(
  'knowledge_links',
  {
    id: id(),
    workspaceId: workspaceId(),
    corpusId: uuid('corpus_id').notNull(),
    fromNodeId: uuid('from_node_id').notNull(),
    toNodeId: uuid('to_node_id'),
    linkKind: text('link_kind').notNull(),
    raw: text('raw').notNull(),
    targetPath: text('target_path'),
    externalUrl: text('external_url'),
    resolved: boolean('resolved').notNull().default(false),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceCorpusIdx: index('knowledge_links_workspace_corpus_idx').on(
      table.workspaceId,
      table.corpusId,
    ),
    corpusIdx: index('knowledge_links_corpus_idx').on(table.corpusId),
    fromIdx: index('knowledge_links_from_idx').on(table.fromNodeId),
    toIdx: index('knowledge_links_to_idx').on(table.toNodeId),
  }),
);
