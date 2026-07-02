import { maxPortableZipEntries, maxPortableZipUncompressedBytes } from '@evu/kb-core';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/errors.js';
import {
  assertPortableZipImportLimits,
  filterPortableZipEntries,
} from '../src/services/import-shared.js';

describe('portable zip import limits', () => {
  it('filters safe file entries', () => {
    const entries = filterPortableZipEntries({
      '.evukb/manifest.json': new Uint8Array([123]),
      'files/readme.md': new Uint8Array([35]),
    });
    expect(entries.has('.evukb/manifest.json')).toBe(true);
    expect(entries.has('files/readme.md')).toBe(true);
  });

  it('rejects zip archives with too many entries', () => {
    const entries: Record<string, Uint8Array> = {};
    for (let index = 0; index < maxPortableZipEntries + 1; index += 1) {
      entries[`files/file-${index}.md`] = new Uint8Array([35]);
    }
    expect(() => assertPortableZipImportLimits(entries)).toThrow(ApiError);
  });

  it('rejects zip archives exceeding uncompressed byte budget', () => {
    const oversized = new Uint8Array(maxPortableZipUncompressedBytes + 1);
    expect(() =>
      assertPortableZipImportLimits({
        'files/huge.md': oversized,
      }),
    ).toThrow(ApiError);
  });
});
