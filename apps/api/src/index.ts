import { pathToFileURL } from 'node:url';

import { createEvuKbServer } from '@evu/kb-server';

import { loadApiConfig } from './config.js';

export async function main(): Promise<void> {
  const config = loadApiConfig();
  const server = await createEvuKbServer({
    blobRoot: config.blobRoot,
    ...(config.databaseUrl ? { connectionString: config.databaseUrl } : {}),
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
