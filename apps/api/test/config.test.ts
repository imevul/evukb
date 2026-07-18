import { describe, expect, it } from 'vitest';

import { loadApiConfig } from '../src/config.js';

describe('api config', () => {
  it('loads defaults and explicit port values', () => {
    expect(loadApiConfig({})).toEqual({
      blobRoot: '.evukb/corpus-store',
      databaseUrl: undefined,
      host: '0.0.0.0',
      port: 4201,
    });

    expect(
      loadApiConfig({
        EVUKB_API_PORT: '4301',
        EVUKB_BLOB_ROOT: '/tmp/evukb',
        EVUKB_DATABASE_URL: 'postgres://evukb:evukb@localhost:5434/evukb',
        EVUKB_HOST: '127.0.0.1',
      }),
    ).toEqual({
      blobRoot: '/tmp/evukb',
      databaseUrl: 'postgres://evukb:evukb@localhost:5434/evukb',
      host: '127.0.0.1',
      port: 4301,
    });
  });
});
