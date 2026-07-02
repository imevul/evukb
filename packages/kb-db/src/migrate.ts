import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDb, type DbHandle, resolveDatabaseUrl } from './client.js';

function resolveMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'migrations');
}

export type MigrationResult = {
  applied: true;
  migrationsFolder: string;
};

export async function migrateLatest(
  handle: DbHandle,
  migrationsFolder = resolveMigrationsFolder(),
): Promise<MigrationResult> {
  await handle.pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await handle.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await migrate(handle.db, { migrationsFolder });
  return {
    applied: true,
    migrationsFolder,
  };
}

export async function checkMigrationStatus(handle: DbHandle): Promise<{
  ready: boolean;
  appliedCount: number;
}> {
  try {
    const result = await handle.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations',
    );
    return {
      ready: true,
      appliedCount: Number.parseInt(result.rows[0]?.count ?? '0', 10),
    };
  } catch {
    return {
      ready: false,
      appliedCount: 0,
    };
  }
}

export async function runMigrationsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MigrationResult> {
  const handle = createDb({ connectionString: resolveDatabaseUrl(env) });
  try {
    return await migrateLatest(handle);
  } finally {
    await handle.close();
  }
}

async function main(): Promise<void> {
  const result = await runMigrationsFromEnv();
  console.info(`@evu/kb-db: migrations applied from ${result.migrationsFolder}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
