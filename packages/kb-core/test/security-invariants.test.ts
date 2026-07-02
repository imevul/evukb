import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  asCorpusId,
  assertPortableFileEntry,
  asWorkspaceId,
  createBlobRef,
  LocalFilesystemBlobStore,
  maxPortableZipEntries,
  maxPortableZipUncompressedBytes,
  normalizeArchiveZipEntry,
  normalizePortableZipEntry,
} from '../src/index.js';

describe('security invariant fixtures', () => {
  it('rejects portable zip traversal and blocked segments', () => {
    expect(() => normalizePortableZipEntry('files/../escape.txt')).toThrow(/Unsafe zip entry/);
    expect(normalizePortableZipEntry('files/.git/config')).toBe('files/.git/config');
    expect(() => assertPortableFileEntry('.evukb/manifest.json')).toThrow(/outside files/);
  });

  it('rejects generic archive zip traversal', () => {
    expect(() => normalizeArchiveZipEntry('notes/../escape.txt')).toThrow(/Unsafe zip entry/);
    expect(normalizeArchiveZipEntry('.git/config')).toBe('.git/config');
    expect(normalizeArchiveZipEntry('.obsidian/config.json')).toBe('.obsidian/config.json');
  });

  it('documents portable zip bomb limits', () => {
    expect(maxPortableZipEntries).toBeGreaterThan(0);
    expect(maxPortableZipUncompressedBytes).toBeGreaterThan(0);
  });

  it('rejects unsafe blob relative paths at ref creation', () => {
    expect(() =>
      createBlobRef(asWorkspaceId('ws-a'), asCorpusId('corpus-a'), '../outside.txt'),
    ).toThrow(/Unsafe relative path/);
  });

  it('blocks symlink reads that escape the blob root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-blob-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'evukb-outside-'));
    const workspaceDir = join(root, 'ws-a', 'corpus-a', 'managed');
    mkdirSync(workspaceDir, { recursive: true });
    const targetFile = join(outside, 'secret.txt');
    writeFileSync(targetFile, 'secret');
    symlinkSync(targetFile, join(workspaceDir, 'escape.txt'));

    const store = new LocalFilesystemBlobStore({ rootDir: root });
    const ref = createBlobRef(asWorkspaceId('ws-a'), asCorpusId('corpus-a'), 'managed/escape.txt');

    await expect(store.get(ref)).rejects.toThrow(/escapes the configured blob root/);

    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('blocks symlink deletes that escape the blob root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-blob-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'evukb-outside-'));
    const workspaceDir = join(root, 'ws-a', 'corpus-a', 'managed');
    mkdirSync(workspaceDir, { recursive: true });
    const targetFile = join(outside, 'secret.txt');
    writeFileSync(targetFile, 'secret');
    symlinkSync(targetFile, join(workspaceDir, 'escape.txt'));

    const store = new LocalFilesystemBlobStore({ rootDir: root });
    const ref = createBlobRef(asWorkspaceId('ws-a'), asCorpusId('corpus-a'), 'managed/escape.txt');

    await expect(store.delete(ref)).rejects.toThrow(/escapes the configured blob root/);
    expect(existsSync(targetFile)).toBe(true);

    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('ignores deletes for blobs that do not exist', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evukb-blob-root-'));
    const store = new LocalFilesystemBlobStore({ rootDir: root });
    const ref = createBlobRef(asWorkspaceId('ws-a'), asCorpusId('corpus-a'), 'managed/missing');

    await expect(store.delete(ref)).resolves.toBeUndefined();

    rmSync(root, { recursive: true, force: true });
  });
});
