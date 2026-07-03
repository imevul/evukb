import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { bytea, createdAt, id, ts, workspaceId } from './_helpers.js';

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    workspaceId: workspaceId(),
    userId: uuid('user_id'),
    name: text('name').notNull().default(''),
    hash: text('hash').notNull(),
    scopes: jsonb('scopes').notNull().default([]),
    writePathPrefixes: jsonb('write_path_prefixes'),
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceIdx: index('api_keys_workspace_idx').on(table.workspaceId),
    hashUnique: uniqueIndex('api_keys_hash_uq').on(table.hash),
  }),
);

export const mcpTokens = pgTable(
  'mcp_tokens',
  {
    id: id(),
    workspaceId: workspaceId(),
    userId: uuid('user_id'),
    name: text('name').notNull().default(''),
    hash: text('hash').notNull(),
    scopes: jsonb('scopes').notNull().default([]),
    writePathPrefixes: jsonb('write_path_prefixes'),
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceIdx: index('mcp_tokens_workspace_idx').on(table.workspaceId),
    hashUnique: uniqueIndex('mcp_tokens_hash_uq').on(table.hash),
  }),
);

export const secrets = pgTable(
  'secrets',
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text('name').notNull(),
    ciphertext: bytea('ciphertext').notNull(),
    nonce: bytea('nonce').notNull(),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceNameUnique: uniqueIndex('secrets_workspace_name_uq').on(table.workspaceId, table.name),
    workspaceIdx: index('secrets_workspace_idx').on(table.workspaceId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    workspaceId: workspaceId(),
    actor: jsonb('actor').notNull(),
    action: text('action').notNull(),
    target: jsonb('target'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => ({
    workspaceCreatedIdx: index('audit_log_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
    workspaceActionIdx: index('audit_log_workspace_action_idx').on(table.workspaceId, table.action),
  }),
);
