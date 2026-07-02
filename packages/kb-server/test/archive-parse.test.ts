import { portableManifestPath } from '@evu/kb-core';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';

import { parseZipUpload, resolveArchiveImport } from '../src/services/archive-parse.js';

describe('resolveArchiveImport', () => {
  it('detects portable archives at the zip root', () => {
    const resolved = resolveArchiveImport({
      [portableManifestPath]: strToU8('{}'),
      'files/readme.md': strToU8('# hello'),
    });
    expect(resolved.mode).toBe('portable');
    expect(resolved.entries.has(portableManifestPath)).toBe(true);
  });

  it('imports generic archives with a shared root folder stripped', () => {
    const resolved = resolveArchiveImport({
      'vault/notes/a.md': strToU8('a'),
      'vault/notes/b.md': strToU8('b'),
    });
    expect(resolved.mode).toBe('archive');
    expect([...resolved.entries.keys()].sort()).toEqual(['notes/a.md', 'notes/b.md']);
  });

  it('unwraps a single nested portable archive', () => {
    const innerZip = zipSync({
      [portableManifestPath]: strToU8('{}'),
      'files/readme.md': strToU8('# hello'),
    });
    const resolved = resolveArchiveImport({
      'backup.evukb': innerZip,
    });
    expect(resolved.mode).toBe('portable');
    expect(resolved.entries.has('files/readme.md')).toBe(true);
  });

  it('autostrips .git entries and reports the count', () => {
    const resolved = resolveArchiveImport({
      'notes/readme.md': strToU8('# hello'),
      '.git/HEAD': strToU8('ref'),
      'vault/.git/config': strToU8('cfg'),
    });
    expect(resolved.mode).toBe('archive');
    expect(resolved.autostrippedCount).toBe(2);
    expect([...resolved.entries.keys()]).toEqual(['readme.md']);
  });
});

describe('archive import budgets', () => {
  const previousLimit = process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES;

  afterEach(() => {
    if (previousLimit === undefined) {
      delete process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES;
    } else {
      process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = previousLimit;
    }
  });

  it('applies a cumulative byte budget across nested archive layers', () => {
    process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = '4096';

    // The inner layer alone fits the limit, but outer (compressed body)
    // plus inner (uncompressed entries) together exceed it. Random bytes keep
    // the nested zip roughly the same size as its content.
    const incompressible = new Uint8Array(3 * 1024);
    for (let index = 0; index < incompressible.length; index += 1) {
      incompressible[index] = Math.floor(Math.random() * 256);
    }
    const innerZip = zipSync({ 'notes/big.md': incompressible });
    expect(innerZip.byteLength + incompressible.length).toBeGreaterThan(4096);

    expect(() =>
      resolveArchiveImport({
        'backup.zip': innerZip,
      }),
    ).toThrow(/across nested layers|uncompressed size/);
  });

  it('rejects zips whose central directory declares sizes beyond the limit before inflating', () => {
    process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = '1024';
    const zip = Buffer.from(
      zipSync({
        'big.bin': new Uint8Array(8 * 1024).fill(1),
      }),
    );
    expect(() => parseZipUpload(zip)).toThrow(/uncompressed size/);
  });

  it('accepts archives within the configured budget', () => {
    process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = '1048576';
    const resolved = resolveArchiveImport({
      'notes/a.md': strToU8('hello'),
    });
    expect(resolved.mode).toBe('archive');
  });
});
