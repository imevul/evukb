import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { createdAt, id, ts, updatedAt, workspaceId } from './_helpers.js';

export const mutationApprovalRequests = pgTable(
  'mutation_approval_requests',
  {
    id: id(),
    workspaceId: workspaceId(),
    corpusId: uuid('corpus_id').notNull(),
    status: text('status').notNull(),
    action: text('action').notNull(),
    request: jsonb('request').notNull(),
    actor: jsonb('actor').notNull(),
    preview: jsonb('preview').notNull(),
    decidedBy: jsonb('decided_by'),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    workspaceStatusCreatedIdx: index('mutation_approval_workspace_status_created_idx').on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
  }),
);
