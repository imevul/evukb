import { index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { createdAt, id, workspaceId } from './_helpers.js';

export const usageRecords = pgTable(
  'usage_records',
  {
    id: id(),
    workspaceId: workspaceId(),
    corpusId: uuid('corpus_id'),
    nodeId: uuid('node_id'),
    operationType: text('operation_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    characterCount: integer('character_count'),
    chunkCount: integer('chunk_count'),
    requestCount: integer('request_count').notNull().default(1),
    latencyMs: integer('latency_ms').notNull(),
    estimatedCost: numeric('estimated_cost'),
    currency: text('currency'),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceCreatedIdx: index('usage_records_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
  }),
);
