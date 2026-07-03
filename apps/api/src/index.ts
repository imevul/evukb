import { pathToFileURL } from 'node:url';

import { createEvuKbServer } from '@evu/kb-server';

import { loadApiConfig } from './config.js';
import { resolveRankingRegistryForApi } from './example-ranking-strategies.js';

export async function main(): Promise<void> {
  const config = loadApiConfig();
  const rankingRegistry = await resolveRankingRegistryForApi();
  const server = await createEvuKbServer({
    blobRoot: config.blobRoot,
    ...(config.databaseUrl ? { connectionString: config.databaseUrl } : {}),
    ...(rankingRegistry ? { rankingRegistry } : {}),
  });

  await server.listen({
    host: config.host,
    port: config.port,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
