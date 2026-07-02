import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, id, ts } from './_helpers.js';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    createdAt: createdAt(),
    lastLoginAt: ts('last_login_at'),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_uq').on(table.email),
  }),
);
