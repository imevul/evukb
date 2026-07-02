import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema/index.js';

export type EvuKbDb = NodePgDatabase<typeof schema>;

export type DbHandle = {
  db: EvuKbDb;
  pool: pg.Pool;
  close: () => Promise<void>;
};

export type CreateDbOptions = {
  connectionString: string;
  max?: number;
};

export function createDb(options: CreateDbOptions): DbHandle {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.EVUKB_DATABASE_URL;
  if (!url) {
    throw new Error('EVUKB_DATABASE_URL is required');
  }
  return url;
}
