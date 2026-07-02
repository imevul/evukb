import { index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, id } from './_helpers.js';

export const workspaces = pgTable(
  'workspaces',
  {
    id: id(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    settings: jsonb('settings').notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex('workspaces_slug_uq').on(table.slug),
    nameIdx: index('workspaces_name_idx').on(table.name),
  }),
);
