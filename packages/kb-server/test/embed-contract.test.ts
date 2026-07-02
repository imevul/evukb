import { describe, expect, it } from 'vitest';

import type { EvuKbServerOptions } from '../src/index.js';

/** Documented option keys from docs/EMBED.md — catches drift without starting a server. */
const documentedEmbedOptionKeys = [
  'blobRoot',
  'bootstrapDevWorkspace',
  'chatProvider',
  'connectionString',
  'logger',
  'maxUploadBytes',
  'scope',
] as const satisfies readonly (keyof EvuKbServerOptions)[];

describe('embed contract', () => {
  it('documents EvuKbServerOptions keys from EMBED.md', () => {
    expect(documentedEmbedOptionKeys).toHaveLength(7);

    const assignable: EvuKbServerOptions = {};
    for (const key of documentedEmbedOptionKeys) {
      expect(key satisfies keyof EvuKbServerOptions).toBeDefined();
      if (key === 'blobRoot') {
        assignable.blobRoot = '/data/blobs';
      }
    }

    expect(assignable.blobRoot).toBe('/data/blobs');
  });
});
