import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  ArchiveImportBudget,
  ArchiveImportLimitError,
  assertArchiveZipImportLimits,
  assertZipDeclaredSizesWithinLimits,
  findSingleNestedArchiveEntry,
  isPortableArchive,
  normalizeArchiveZipEntry,
  readZipDeclaredTotals,
  shouldAutostripArchiveZipEntry,
  stripAutostrippedZipEntries,
  stripSingleRootPrefix,
} from '../src/archive/index.js';
import { portableManifestPath } from '../src/portable/types.js';

describe('archive zip paths', () => {
  it('normalizes safe archive entries', () => {
    expect(normalizeArchiveZipEntry('notes/readme.md')).toBe('notes/readme.md');
    expect(normalizeArchiveZipEntry('.obsidian/config.json')).toBe('.obsidian/config.json');
  });

  it('rejects traversal and blocked segments', () => {
    expect(() => normalizeArchiveZipEntry('notes/../secret.txt')).toThrow(/Unsafe zip entry/);
    expect(normalizeArchiveZipEntry('.git/config')).toBe('.git/config');
  });
});

describe('autostrip archive entries', () => {
  it('detects .git paths for autostrip', () => {
    expect(shouldAutostripArchiveZipEntry('.git/config')).toBe(true);
    expect(shouldAutostripArchiveZipEntry('vault/.git/HEAD')).toBe(true);
    expect(shouldAutostripArchiveZipEntry('notes/readme.md')).toBe(false);
  });

  it('removes autostripped entries before import', () => {
    const stripped = stripAutostrippedZipEntries({
      'notes/readme.md': new Uint8Array([97]),
      '.git/HEAD': new Uint8Array([98]),
      'vault/.git/config': new Uint8Array([99]),
    });
    expect(stripped.autostrippedCount).toBe(2);
    expect(Object.keys(stripped.entries)).toEqual(['notes/readme.md']);
  });
});

describe('isPortableArchive', () => {
  it('detects portable manifests', () => {
    const entries = new Map<string, Uint8Array>([[portableManifestPath, new Uint8Array([123])]]);
    expect(isPortableArchive(entries)).toBe(true);
  });

  it('returns false for generic archives', () => {
    const entries = new Map<string, Uint8Array>([['notes/readme.md', new Uint8Array([104])]]);
    expect(isPortableArchive(entries)).toBe(false);
  });
});

describe('stripSingleRootPrefix', () => {
  it('strips a shared top-level folder', () => {
    const entries = new Map<string, Uint8Array>([
      ['vault/notes/a.md', new Uint8Array([97])],
      ['vault/notes/b.md', new Uint8Array([98])],
    ]);
    expect(stripSingleRootPrefix(entries)).toEqual(
      new Map([
        ['notes/a.md', new Uint8Array([97])],
        ['notes/b.md', new Uint8Array([98])],
      ]),
    );
  });

  it('keeps entries when root files exist', () => {
    const entries = new Map<string, Uint8Array>([
      ['readme.md', new Uint8Array([114])],
      ['vault/notes/a.md', new Uint8Array([97])],
    ]);
    expect(stripSingleRootPrefix(entries)).toEqual(entries);
  });
});

describe('findSingleNestedArchiveEntry', () => {
  it('finds a single nested zip entry', () => {
    const innerZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const entries = new Map<string, Uint8Array>([['backup.evukb', innerZip]]);
    expect(findSingleNestedArchiveEntry(entries)).toEqual({
      entryName: 'backup.evukb',
      body: innerZip,
    });
  });

  it('returns null for multiple files', () => {
    const entries = new Map<string, Uint8Array>([
      ['a.md', new Uint8Array([97])],
      ['b.md', new Uint8Array([98])],
    ]);
    expect(findSingleNestedArchiveEntry(entries)).toBeNull();
  });
});

describe('assertArchiveZipImportLimits', () => {
  it('rejects oversized archives', () => {
    expect(() =>
      assertArchiveZipImportLimits(
        {
          'large.bin': new Uint8Array(101 * 1024 * 1024),
        },
        { maxEntries: 10_000, maxUncompressedBytes: 100 * 1024 * 1024 },
      ),
    ).toThrow(ArchiveImportLimitError);
  });
});

describe('ArchiveImportBudget', () => {
  it('enforces byte limits cumulatively across nested layers', () => {
    const budget = new ArchiveImportBudget({ maxEntries: 10, maxUncompressedBytes: 100 });
    budget.consume({ 'outer.bin': new Uint8Array(60) });
    expect(budget.remaining()).toEqual({ maxEntries: 9, maxUncompressedBytes: 40 });
    // A second layer that fits its own limit but not the shared budget fails.
    expect(() => budget.consume({ 'inner.bin': new Uint8Array(60) })).toThrow(
      ArchiveImportLimitError,
    );
  });

  it('enforces entry limits cumulatively across nested layers', () => {
    const budget = new ArchiveImportBudget({ maxEntries: 3, maxUncompressedBytes: 1000 });
    budget.consume({ 'a.md': new Uint8Array(1), 'b.md': new Uint8Array(1) });
    expect(() => budget.consume({ 'c.md': new Uint8Array(1), 'd.md': new Uint8Array(1) })).toThrow(
      ArchiveImportLimitError,
    );
  });

  it('ignores directory entries', () => {
    const budget = new ArchiveImportBudget({ maxEntries: 1, maxUncompressedBytes: 10 });
    budget.consume({ 'folder/': new Uint8Array(0), 'folder/a.md': new Uint8Array(1) });
    expect(budget.remaining().maxEntries).toBe(0);
  });
});

function patchCentralDirectoryUncompressedSize(zipBytes: Uint8Array, size: number): Uint8Array {
  const patched = new Uint8Array(zipBytes);
  const view = new DataView(patched.buffer);
  for (let offset = 0; offset + 4 <= patched.length; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      view.setUint32(offset + 24, size, true);
      return patched;
    }
  }
  throw new Error('central directory not found');
}

describe('zip declared-size guards', () => {
  it('reads declared totals from the central directory without inflating', () => {
    const zip = zipSync({
      'a.md': strToU8('hello'),
      'b.md': strToU8('world!'),
    });
    expect(readZipDeclaredTotals(zip)).toEqual({
      entryCount: 2,
      totalUncompressedBytes: 11,
    });
  });

  it('accepts archives within limits', () => {
    const zip = zipSync({ 'a.md': strToU8('hello') });
    expect(() => assertZipDeclaredSizesWithinLimits(zip)).not.toThrow();
  });

  it('rejects archives declaring more uncompressed bytes than allowed', () => {
    const zip = zipSync({ 'a.md': strToU8('hello') });
    expect(() =>
      assertZipDeclaredSizesWithinLimits(zip, { maxEntries: 10, maxUncompressedBytes: 3 }),
    ).toThrow(ArchiveImportLimitError);
  });

  it('rejects archives declaring more entries than allowed', () => {
    const zip = zipSync({ 'a.md': strToU8('a'), 'b.md': strToU8('b') });
    expect(() =>
      assertZipDeclaredSizesWithinLimits(zip, { maxEntries: 1, maxUncompressedBytes: 1000 }),
    ).toThrow(ArchiveImportLimitError);
  });

  it('rejects implausible compression ratios before decompression', () => {
    // A tiny zip whose central directory claims a ~4 GiB uncompressed entry.
    const zip = zipSync({ 'bomb.bin': strToU8('x') });
    const bomb = patchCentralDirectoryUncompressedSize(zip, 0xfffffffe);
    expect(() =>
      assertZipDeclaredSizesWithinLimits(bomb, {
        maxEntries: 10,
        maxUncompressedBytes: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/compression ratio/);
  });

  it('treats zip64 markers as exceeding any limit', () => {
    const zip = zipSync({ 'bomb.bin': strToU8('x') });
    const bomb = patchCentralDirectoryUncompressedSize(zip, 0xffffffff);
    expect(() => assertZipDeclaredSizesWithinLimits(bomb)).toThrow(ArchiveImportLimitError);
  });
});
