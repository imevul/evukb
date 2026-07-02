import { describe, expect, it } from 'vitest';

import {
  assertPortableFileEntry,
  buildPortableManifest,
  isPortableManifestEntry,
  normalizePortableZipEntry,
  parsePortableManifestJson,
  validatePortableManifest,
} from '../src/portable/index.js';

const validManifest = {
  format: 'evukb-portable',
  version: 1,
  exportedAt: '2026-06-30T12:00:00.000Z',
  corpus: { name: 'Demo', settings: {} },
  nodes: [
    {
      id: 'node-1',
      path: '',
      name: 'readme.md',
      contentHash: 'abc123',
      mimeType: 'text/markdown',
      metadata: {},
      sourceType: 'managed',
    },
  ],
  links: [],
  checksums: { 'readme.md': 'abc123' },
};

describe('portable manifest', () => {
  it('validates a v1 manifest', () => {
    const manifest = validatePortableManifest(validManifest);
    expect(manifest.format).toBe('evukb-portable');
    expect(manifest.nodes).toHaveLength(1);
  });

  it('rejects unknown format/version', () => {
    expect(() => validatePortableManifest({ ...validManifest, format: 'other' })).toThrow(
      /Unsupported manifest format/,
    );
    expect(() => validatePortableManifest({ ...validManifest, version: 2 })).toThrow(
      /Unsupported manifest version/,
    );
  });

  it('parses manifest JSON', () => {
    const manifest = parsePortableManifestJson(JSON.stringify(validManifest));
    expect(manifest.corpus.name).toBe('Demo');
  });

  it('builds a manifest with defaults', () => {
    const manifest = buildPortableManifest({
      exportedAt: validManifest.exportedAt,
      corpus: validManifest.corpus,
      nodes: validManifest.nodes,
      links: validManifest.links,
      checksums: validManifest.checksums,
    });
    expect(manifest.version).toBe(1);
  });
});

describe('portable zip paths', () => {
  it('normalizes safe zip entries', () => {
    expect(normalizePortableZipEntry('files/docs/readme.md')).toBe('files/docs/readme.md');
    expect(isPortableManifestEntry('.evukb/manifest.json')).toBe(true);
  });

  it('rejects traversal and blocked segments', () => {
    expect(() => normalizePortableZipEntry('files/../secret.txt')).toThrow(/Unsafe zip entry/);
    expect(() => normalizePortableZipEntry('../files/readme.md')).toThrow(/Unsafe zip entry/);
    expect(normalizePortableZipEntry('files/.git/config')).toBe('files/.git/config');
  });

  it('asserts file entries under files/', () => {
    expect(assertPortableFileEntry('files/readme.md')).toBe('readme.md');
    expect(() => assertPortableFileEntry('.evukb/manifest.json')).toThrow(/outside files/);
  });
});
