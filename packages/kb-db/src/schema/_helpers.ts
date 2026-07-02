import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

export const workspaceId = () => uuid('workspace_id').notNull();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => 'bytea',
});

export const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType: () => 'vector(1536)',
  toDriver: (value) => `[${value.join(',')}]`,
  fromDriver: (value) => {
    if (typeof value !== 'string') {
      return [];
    }
    const trimmed = value.replace(/^\[/, '').replace(/\]$/, '');
    if (trimmed.length === 0) {
      return [];
    }
    return trimmed.split(',').map((part) => Number.parseFloat(part));
  },
});
