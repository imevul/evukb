import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { createdAt, workspaceId } from './_helpers.js';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: workspaceId(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
    userIdx: index('workspace_members_user_idx').on(table.userId),
    workspaceIdx: index('workspace_members_workspace_idx').on(table.workspaceId),
  }),
);
