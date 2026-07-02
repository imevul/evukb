export type EvuKbHealthResponse = {
  service: 'evukb-api';
  status: 'ok' | 'degraded';
  scope: string;
  database: {
    status: 'ok' | 'error' | 'not-configured';
    migrationsApplied?: number;
  };
  blobStore: {
    status: 'ok' | 'error' | 'not-configured';
    root?: string;
  };
};
