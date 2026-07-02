import {
  type ArchiveImportResult,
  archiveSourceRef,
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  createBlobRef,
  guessMimeType,
  splitRelativeFilePath,
} from '@evu/kb-core';
import type { CorpusRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import {
  ensureFolderChain,
  isMarkdownFile,
  managedBlobRelPath,
  refreshCorpusFileStats,
  resolveParentId,
  sha256Hex,
} from './import-shared.js';

export type ArchiveImportServiceDeps = {
  blobStore: BlobStore;
  corpora: CorpusRepository;
  jobQueue: JobQueueService;
  nodes: NodeRepository;
};

export class ArchiveImportService {
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #jobQueue: JobQueueService;
  readonly #nodes: NodeRepository;

  constructor(deps: ArchiveImportServiceDeps) {
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#jobQueue = deps.jobQueue;
    this.#nodes = deps.nodes;
  }

  async importGenericZip(
    workspaceId: string,
    corpusId: string,
    entries: ReadonlyMap<string, Uint8Array>,
  ): Promise<ArchiveImportResult> {
    await this.#requireCorpus(workspaceId, corpusId);

    const result: ArchiveImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      indexed: 0,
      warnings: [],
      errors: [],
    };

    if (entries.size === 0) {
      throw ApiError.validation('Archive contains no importable files.');
    }

    const sortedEntries = [...entries.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const indexNodeIds: string[] = [];

    for (const [relativePath, fileBytes] of sortedEntries) {
      try {
        const { parentPath, name } = splitRelativeFilePath(relativePath);
        await ensureFolderChain(this.#nodes, workspaceId, corpusId, parentPath, {
          sourceType: 'managed',
          buildSourceRef: archiveSourceRef,
        });
        const parentId = await resolveParentId(this.#nodes, workspaceId, corpusId, parentPath);
        const contentHash = sha256Hex(fileBytes);
        const mimeType = guessMimeType(name);
        const existing = await this.#nodes.getByPathAndName(
          workspaceId,
          corpusId,
          parentPath,
          name,
        );

        if (existing?.nodeType === 'folder') {
          result.errors.push(`${relativePath}: path conflicts with an existing folder.`);
          continue;
        }

        let nodeId: string;
        if (!existing) {
          const created = await this.#nodes.create({
            workspaceId,
            corpusId,
            parentId,
            path: parentPath,
            name,
            nodeType: 'file',
            sourceType: 'managed',
            sourceRef: archiveSourceRef(relativePath),
            mimeType,
            contentHash,
            sizeBytes: fileBytes.byteLength,
            indexStatus: 'pending',
          });
          nodeId = created.id;
          result.imported += 1;
        } else if (existing.contentHash === contentHash) {
          result.skipped += 1;
          continue;
        } else {
          nodeId = existing.id;
          result.updated += 1;
        }

        const storageRelPath = managedBlobRelPath(nodeId);
        const blobRef = createBlobRef(
          asWorkspaceId(workspaceId),
          asCorpusId(corpusId),
          storageRelPath,
        );
        await this.#blobStore.put({
          ref: blobRef,
          body: Buffer.from(fileBytes),
          contentHash,
        });

        await this.#nodes.updateContent(workspaceId, corpusId, nodeId, {
          contentHash,
          mimeType,
          sizeBytes: fileBytes.byteLength,
          storageRelPath,
        });

        if (isMarkdownFile(name, mimeType)) {
          indexNodeIds.push(nodeId);
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error
            ? `${relativePath}: ${error.message}`
            : `${relativePath}: import failed`,
        );
      }
    }

    result.indexed = await this.#jobQueue.enqueueIndexMany(
      indexNodeIds.map((nodeId) => ({ workspaceId, corpusId, nodeId })),
    );

    await refreshCorpusFileStats(this.#corpora, this.#nodes, workspaceId, corpusId);
    return result;
  }

  async #requireCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    return corpus;
  }
}
