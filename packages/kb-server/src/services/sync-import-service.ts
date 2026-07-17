import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  createBlobRef,
  guessMimeType,
  type MountSyncMode,
  mergeSyncStatus,
  type NodeSourceType,
  type SyncImportResult,
  splitRelativeFilePath,
} from '@evu/kb-core';
import type { AuditLogRepository, CorpusRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import {
  ensureFolderChain,
  importedBlobRelPath,
  isMarkdownFile,
  refreshCorpusFileStats,
  resolveParentId,
  sha256Hex,
} from './import-shared.js';

export type ScannedSyncFile = {
  relativePath: string;
  absolutePath: string;
  sourceType: NodeSourceType;
  sourceRef: string;
};

export type SyncImportOptions = {
  workspaceId: string;
  corpusId: string;
  rootDir: string;
  sourceTypes: NodeSourceType[];
  buildSourceRef: (relativePath: string) => string;
  resolveSourceType: (relativePath: string) => NodeSourceType;
  mountMode?: MountSyncMode;
};

export type SyncImportServiceDeps = {
  auditLog?: AuditLogRepository;
  blobStore: BlobStore;
  corpora: CorpusRepository;
  jobQueue: JobQueueService;
  nodes: NodeRepository;
};

async function walkSyncFiles(
  rootDir: string,
  resolveSourceType: (relativePath: string) => NodeSourceType,
  buildSourceRef: (relativePath: string) => string,
): Promise<ScannedSyncFile[]> {
  const resolvedRoot = await realpath(rootDir);
  const files: ScannedSyncFile[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') {
        continue;
      }
      const absolutePath = path.join(currentDir, entry.name);
      const resolvedPath = await realpath(absolutePath);
      if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) && resolvedPath !== resolvedRoot) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(resolvedPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.relative(resolvedRoot, resolvedPath).replace(/\\/g, '/');
      files.push({
        relativePath,
        absolutePath: resolvedPath,
        sourceType: resolveSourceType(relativePath),
        sourceRef: buildSourceRef(relativePath),
      });
    }
  }

  await walk(resolvedRoot);
  return files;
}

export class SyncImportService {
  readonly #auditLog: AuditLogRepository | undefined;
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #jobQueue: JobQueueService;
  readonly #nodes: NodeRepository;

  constructor(deps: SyncImportServiceDeps) {
    this.#auditLog = deps.auditLog;
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#jobQueue = deps.jobQueue;
    this.#nodes = deps.nodes;
  }

  async scanDirectory(
    rootDir: string,
    resolveSourceType: (relativePath: string) => NodeSourceType,
    buildSourceRef: (relativePath: string) => string,
  ): Promise<ScannedSyncFile[]> {
    const rootStat = await stat(rootDir).catch(() => null);
    if (!rootStat?.isDirectory()) {
      throw ApiError.validation(`Sync root is not a directory: ${rootDir}`);
    }
    return walkSyncFiles(rootDir, resolveSourceType, buildSourceRef);
  }

  async importScannedFiles(options: SyncImportOptions): Promise<SyncImportResult> {
    const corpus = await this.#corpora.getById(options.workspaceId, options.corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(options.corpusId);
    }

    const result: SyncImportResult = {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      indexed: 0,
      errors: [],
    };

    const scanned = await this.scanDirectory(
      options.rootDir,
      options.resolveSourceType,
      options.buildSourceRef,
    );
    const keepSourceRefs = new Set<string>();
    const indexNodeIds: string[] = [];

    for (const file of scanned) {
      try {
        const { parentPath, name } = splitRelativeFilePath(file.relativePath);
        await ensureFolderChain(this.#nodes, options.workspaceId, options.corpusId, parentPath, {
          sourceType: file.sourceType,
          buildSourceRef: (relativePath) => relativePath,
        });

        const parentId = await resolveParentId(
          this.#nodes,
          options.workspaceId,
          options.corpusId,
          parentPath,
        );
        const content = await readFile(file.absolutePath);
        const contentHash = sha256Hex(content);
        const mimeType = guessMimeType(name);
        const existing = await this.#nodes.getBySourceRef(
          options.workspaceId,
          options.corpusId,
          file.sourceType,
          file.sourceRef,
        );

        let nodeId: string;
        if (!existing) {
          const placeholder = await this.#nodes.create({
            workspaceId: options.workspaceId,
            corpusId: options.corpusId,
            parentId,
            path: parentPath,
            name,
            nodeType: 'file',
            sourceType: file.sourceType,
            sourceRef: file.sourceRef,
            mimeType,
            contentHash,
            sizeBytes: content.byteLength,
            indexStatus: 'pending',
          });
          nodeId = placeholder.id;
          result.added += 1;
        } else if (existing.contentHash === contentHash) {
          keepSourceRefs.add(file.sourceRef);
          result.unchanged += 1;
          continue;
        } else {
          nodeId = existing.id;
          result.updated += 1;
        }

        const storageRelPath = importedBlobRelPath(nodeId);
        const blobRef = createBlobRef(
          asWorkspaceId(options.workspaceId),
          asCorpusId(options.corpusId),
          storageRelPath,
        );
        await this.#blobStore.put({ ref: blobRef, body: content, contentHash });

        const saved = await this.#nodes.upsertSyncedFile({
          workspaceId: options.workspaceId,
          corpusId: options.corpusId,
          parentId,
          path: parentPath,
          name,
          sourceType: file.sourceType,
          sourceRef: file.sourceRef,
          storageRelPath,
          contentHash,
          mimeType,
          sizeBytes: content.byteLength,
          changed: true,
        });

        keepSourceRefs.add(file.sourceRef);
        if (isMarkdownFile(name, mimeType)) {
          indexNodeIds.push(saved.id);
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error
            ? `${file.relativePath}: ${error.message}`
            : `${file.relativePath}: import failed`,
        );
      }
    }

    const removed = await this.#nodes.deleteSyncedNodesNotInRefs(
      options.workspaceId,
      options.corpusId,
      options.sourceTypes,
      keepSourceRefs,
    );
    result.removed = removed.length;

    for (const node of removed) {
      if (node.storageRelPath) {
        const blobRef = createBlobRef(
          asWorkspaceId(options.workspaceId),
          asCorpusId(options.corpusId),
          node.storageRelPath,
        );
        await this.#blobStore.delete(blobRef).catch(() => undefined);
      }
    }

    if (options.mountMode === 'mount_authoritative') {
      const keepRelativePaths = new Set(scanned.map((file) => file.relativePath));
      const removedManaged = await this.#nodes.deleteManagedFilesNotInPaths(
        options.workspaceId,
        options.corpusId,
        keepRelativePaths,
      );
      result.removed += removedManaged.length;
      for (const node of removedManaged) {
        if (node.storageRelPath) {
          const blobRef = createBlobRef(
            asWorkspaceId(options.workspaceId),
            asCorpusId(options.corpusId),
            node.storageRelPath,
          );
          await this.#blobStore.delete(blobRef).catch(() => undefined);
        }
      }
    }

    result.indexed = await this.#jobQueue.enqueueIndexMany(
      indexNodeIds.map((nodeId) => ({
        workspaceId: options.workspaceId,
        corpusId: options.corpusId,
        nodeId,
      })),
    );

    await refreshCorpusFileStats(this.#corpora, this.#nodes, options.workspaceId, options.corpusId);

    if (this.#auditLog && result.added + result.updated + result.removed > 0) {
      await this.#auditLog.record({
        workspaceId: options.workspaceId,
        action: 'sync_import',
        actor: { kind: 'system', sourceTypes: options.sourceTypes },
        target: {
          corpusId: options.corpusId,
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          errors: result.errors.length,
        },
      });
    }

    return result;
  }

  async updateSyncStatus(
    workspaceId: string,
    corpusId: string,
    syncStatus: {
      lastSyncAt?: string;
      lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed' | 'writeback_blocked';
      lastSyncError?: string | null;
      lastCommitSha?: string;
      lastWritebackAt?: string;
      lastWritebackError?: string | null;
    },
  ): Promise<void> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      return;
    }
    const existing = (corpus.settings.syncStatus ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(syncStatus)) {
      if (value === null) {
        delete next[key];
      } else if (value !== undefined) {
        next[key] = value;
      }
    }
    await this.#corpora.update(workspaceId, corpusId, {
      settings: mergeSyncStatus(corpus.settings, next as import('@evu/kb-core').SyncStatus),
    });
  }
}
