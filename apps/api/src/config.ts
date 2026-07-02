export type ApiConfig = {
  blobRoot: string;
  databaseUrl?: string;
  host: string;
  port: number;
};

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const portValue = env.EVUKB_API_PORT ?? '4201';
  const port = Number.parseInt(portValue, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`EVUKB_API_PORT must be a positive integer, received "${portValue}"`);
  }

  return {
    blobRoot: env.EVUKB_BLOB_ROOT ?? '.evukb/corpus-store',
    ...(env.EVUKB_DATABASE_URL ? { databaseUrl: env.EVUKB_DATABASE_URL } : {}),
    host: env.EVUKB_HOST ?? '0.0.0.0',
    port,
  };
}
