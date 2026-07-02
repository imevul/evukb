import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { BlobRef, BlobStat, BlobStore, PutBlobInput } from './adapters.js';
import { blobRefToStorageKey, createBlobRef, resolveBlobAbsolutePath } from './path-safety.js';

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export type LocalFilesystemBlobStoreOptions = {
  rootDir: string;
};

export class LocalFilesystemBlobStore implements BlobStore {
  readonly #rootDir: string;

  constructor(options: LocalFilesystemBlobStoreOptions) {
    this.#rootDir = path.resolve(options.rootDir);
  }

  get rootDir(): string {
    return this.#rootDir;
  }

  async put(input: PutBlobInput): Promise<BlobRef> {
    const absolutePath = resolveBlobAbsolutePath(this.#rootDir, input.ref);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    if (input.body instanceof ReadableStream) {
      const buffer = await streamToBuffer(input.body);
      await writeFile(absolutePath, buffer);
    } else {
      await writeFile(absolutePath, input.body);
    }

    return createBlobRef(input.ref.workspaceId, input.ref.corpusId, input.ref.relPath);
  }

  async get(ref: BlobRef): Promise<ReadableStream<Uint8Array>> {
    const absolutePath = await assertBlobPathWithinRoot(this.#rootDir, ref);
    const nodeStream = createReadStream(absolutePath);
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }

  async stat(ref: BlobRef): Promise<BlobStat> {
    const absolutePath = await assertBlobPathWithinRoot(this.#rootDir, ref);
    const fileStat = await stat(absolutePath);
    return {
      ...ref,
      sizeBytes: fileStat.size,
      contentHash: null,
      updatedAt: fileStat.mtime.toISOString(),
    };
  }

  async delete(ref: BlobRef): Promise<void> {
    let absolutePath: string;
    try {
      absolutePath = await assertBlobPathWithinRoot(this.#rootDir, ref);
    } catch (error) {
      // Nothing to delete when the blob (or a dangling symlink target) is gone.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
    await rm(absolutePath, { force: true });
  }

  async *list(prefix: BlobRef): AsyncIterable<BlobStat> {
    const prefixKey = blobRefToStorageKey(prefix);
    const prefixDir = path.resolve(this.#rootDir, prefixKey);
    const root = this.#rootDir;
    if (prefixDir !== root && !prefixDir.startsWith(`${root}${path.sep}`)) {
      throw new Error('List prefix escapes the configured blob root.');
    }

    async function* walk(currentDir: string): AsyncGenerator<BlobStat> {
      let entries: string[];
      try {
        entries = await readdir(currentDir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const absolute = path.join(currentDir, entry);
        const entryStat = await stat(absolute);
        if (entryStat.isDirectory()) {
          yield* walk(absolute);
          continue;
        }
        const relative = path.relative(root, absolute).replace(/\\/g, '/');
        const segments = relative.split('/').filter(Boolean);
        if (segments.length < 3) {
          continue;
        }
        const [workspaceId, corpusId, ...rest] = segments;
        yield {
          ...createBlobRef(
            workspaceId as BlobRef['workspaceId'],
            corpusId as BlobRef['corpusId'],
            rest.join('/'),
          ),
          sizeBytes: entryStat.size,
          contentHash: null,
          updatedAt: entryStat.mtime.toISOString(),
        };
      }
    }

    yield* walk(prefixDir);
  }
}

async function assertBlobPathWithinRoot(rootDir: string, ref: BlobRef): Promise<string> {
  const candidate = resolveBlobAbsolutePath(rootDir, ref);
  const resolvedRoot = await realpath(rootDir);
  const resolvedPath = await realpath(candidate);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Resolved blob path escapes the configured blob root.');
  }
  return resolvedPath;
}

export async function copyStreamToFile(
  stream: ReadableStream<Uint8Array>,
  destinationPath: string,
): Promise<void> {
  const nodeStream = Readable.fromWeb(stream as import('node:stream/web').ReadableStream);
  await pipeline(nodeStream, createWriteStream(destinationPath));
}
