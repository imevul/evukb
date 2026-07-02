import { gzipSync, strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  buildArchiveZipFromTarEntries,
  extractArchiveTarEntries,
  normalizeArchiveUploadBytes,
  stemFromArchiveName,
} from '../src/lib/archive-import-normalize.js';

function buildTarEntry(name: string, body: Uint8Array): Uint8Array {
  const header = new Uint8Array(512);
  const encoder = new TextEncoder();
  header.set(encoder.encode(name), 0);
  const sizeOctal = body.length.toString(8).padStart(11, '0');
  header.set(encoder.encode(`${sizeOctal}\0`), 124);
  header[156] = '0'.charCodeAt(0);
  header.set(encoder.encode('ustar\0'), 257);
  header.set(encoder.encode('00'), 263);

  const paddedSize = Math.ceil(body.length / 512) * 512;
  const paddedBody = new Uint8Array(paddedSize);
  paddedBody.set(body);

  const archive = new Uint8Array(512 + paddedSize + 1024);
  archive.set(header, 0);
  archive.set(paddedBody, 512);
  return archive;
}

function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

describe('stemFromArchiveName', () => {
  it('strips common archive extensions', () => {
    expect(stemFromArchiveName('notes.evukb.zip')).toBe('notes');
    expect(stemFromArchiveName('notes.tar.gz')).toBe('notes');
    expect(stemFromArchiveName('notes.tgz')).toBe('notes');
    expect(stemFromArchiveName('notes.evukb')).toBe('notes');
    expect(stemFromArchiveName('notes.zip')).toBe('notes');
    expect(stemFromArchiveName('notes.gz')).toBe('notes');
  });
});

describe('normalizeArchiveUploadBytes', () => {
  it('accepts zip archives unchanged', () => {
    const zip = zipSync({ 'files/readme.md': strToU8('hello') });
    expect(normalizeArchiveUploadBytes(zip, 'readme.zip')).toEqual(zip);
  });

  it('accepts gzip-compressed zip archives', () => {
    const zip = zipSync({ 'notes/readme.md': strToU8('hello') });
    expect(normalizeArchiveUploadBytes(gzipSync(zip), 'portable.gz')).toEqual(zip);
  });

  it('repacks tar.gz archives into zip', () => {
    const tar = buildTarEntry('notes/readme.md', strToU8('hello'));
    const normalized = normalizeArchiveUploadBytes(gzipSync(tar), 'portable.tar.gz');
    expect(isZipBytes(normalized)).toBe(true);
  });

  it('rejects gzip archives declaring an oversized decompressed size', () => {
    const gz = gzipSync(strToU8('hello'));
    // Patch the ISIZE trailer to claim ~4 GiB of decompressed output.
    const bomb = new Uint8Array(gz);
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    view.setUint32(bomb.length - 4, 0xfffffffe, true);
    expect(() => normalizeArchiveUploadBytes(bomb, 'bomb.gz')).toThrow(/maximum uncompressed size/);
  });
});

describe('extractArchiveTarEntries', () => {
  it('extracts regular tar files', () => {
    const tar = buildTarEntry('files/readme.md', strToU8('hello'));
    const entries = extractArchiveTarEntries(tar);
    expect(entries.get('files/readme.md')).toEqual(strToU8('hello'));
  });
});

describe('buildArchiveZipFromTarEntries', () => {
  it('creates a zip archive from tar entries', () => {
    const zip = buildArchiveZipFromTarEntries(new Map([['files/readme.md', strToU8('hello')]]));
    expect(isZipBytes(zip)).toBe(true);
  });
});
