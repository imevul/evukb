import {
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  buildFilePath,
  buildPortableManifest,
  type CorpusArchiveImportResult,
  createBlobRef,
  type EvuKbPortableManifestV1,
  type PortableImportResult,
  parsePortableManifestJson,
  portableFileZipPath,
  portableManifestPath,
  portableSourceRef,
  splitRelativeFilePath,
} from '@evu/kb-core';
import type {
  AuditLogRepository,
  CorpusRepository,
  LinkRepository,
  NodeRepository,
} from '@evu/kb-db';
import { zipSync } from 'fflate';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { ArchiveImportService } from './archive-import-service.js';
import {
  appendAutostrippedArchiveWarnings,
  parseZipUpload,
  resolveArchiveImport,
} from './archive-parse.js';
import type { FileManagerService } from './file-manager.js';
import {
  ensureFolderChain,
  importedBlobRelPath,
  isMarkdownFile,
  refreshCorpusFileStats,
  resolveParentId,
  sha256Hex,
} from './import-shared.js';

export type PortableServiceDeps = {
  archiveImportService: ArchiveImportService;
  auditLog?: AuditLogRepository;
  blobStore: BlobStore;
  corpora: CorpusRepository;
  fileManager: FileManagerService;
  jobQueue: JobQueueService;
  links: LinkRepository;
  nodes: NodeRepository;
};

export type PortableImportContext = {
  /** When set, the import is recorded in the workspace audit log with this actor. */
  auditActor?: Record<string, unknown>;
};

export class PortableService {
  readonly #archiveImportService: ArchiveImportService;
  readonly #auditLog: AuditLogRepository | undefined;
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #fileManager: FileManagerService;
  readonly #jobQueue: JobQueueService;
  readonly #links: LinkRepository;
  readonly #nodes: NodeRepository;

  constructor(deps: PortableServiceDeps) {
    this.#archiveImportService = deps.archiveImportService;
    this.#auditLog = deps.auditLog;
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#fileManager = deps.fileManager;
    this.#jobQueue = deps.jobQueue;
    this.#links = deps.links;
    this.#nodes = deps.nodes;
  }

  async #recordImportAudit(
    workspaceId: string,
    context: PortableImportContext,
    target: Record<string, unknown>,
  ): Promise<void> {
    if (!this.#auditLog || !context.auditActor) {
      return;
    }
    await this.#auditLog.record({
      workspaceId,
      action: 'import_archive',
      actor: context.auditActor,
      target,
    });
  }

  async exportCorpusPortableZip(
    workspaceId: string,
    corpusId: string,
  ): Promise<{ zip: Buffer; fileName: string }> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const links = await this.#links.listByCorpus(workspaceId, corpusId);
    const zipEntries: Record<string, Uint8Array> = {};
    const checksums: Record<string, string> = {};
    const exportNodes: EvuKbPortableManifestV1['nodes'] = [];

    for (const node of nodes) {
      if (node.nodeType !== 'file' || !node.storageRelPath) {
        continue;
      }

      const { content } = await this.#fileManager.readContent(workspaceId, corpusId, node.id);
      const relativePath = buildFilePath(node.path, node.name);
      const contentHash = sha256Hex(content);
      checksums[relativePath] = contentHash;
      zipEntries[portableFileZipPath(relativePath)] = new Uint8Array(content);
      exportNodes.push({
        id: node.id,
        path: node.path,
        name: node.name,
        contentHash,
        mimeType: node.mimeType,
        metadata: node.metadata,
        sourceType: node.sourceType,
      });
    }

    const manifest = buildPortableManifest({
      exportedAt: new Date().toISOString(),
      corpus: {
        name: corpus.name,
        settings: corpus.settings,
      },
      nodes: exportNodes,
      links: links.map((link) => ({
        fromNodeId: link.fromNodeId,
        toNodeId: link.toNodeId,
        linkKind: link.linkKind,
        raw: link.raw,
        targetPath: link.targetPath,
        externalUrl: link.externalUrl,
        resolved: link.resolved,
        metadata: link.metadata,
      })),
      checksums,
    });

    zipEntries[portableManifestPath] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    const safeName =
      corpus.name
        .trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '') || corpusId;

    return {
      zip: Buffer.from(zipSync(zipEntries)),
      fileName: `${safeName}.evukb.zip`,
    };
  }

  async importCorpusArchive(
    workspaceId: string,
    corpusId: string,
    zipBuffer: Buffer,
    context: PortableImportContext = {},
  ): Promise<CorpusArchiveImportResult> {
    const rawEntries = parseZipUpload(zipBuffer);
    const resolved = resolveArchiveImport(rawEntries);

    let archiveResult: CorpusArchiveImportResult;
    if (resolved.mode === 'portable') {
      const result = await this.importCorpusPortableFromEntries(
        workspaceId,
        corpusId,
        resolved.entries,
      );
      archiveResult = {
        ...result,
        mode: 'portable',
        warnings: appendAutostrippedArchiveWarnings(result.warnings, resolved.autostrippedCount),
      };
    } else {
      const result = await this.#archiveImportService.importGenericZip(
        workspaceId,
        corpusId,
        resolved.entries,
      );
      archiveResult = {
        mode: 'archive',
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        linksRestored: 0,
        indexed: result.indexed,
        warnings: appendAutostrippedArchiveWarnings(result.warnings, resolved.autostrippedCount),
        errors: result.errors,
      };
    }

    await this.#recordImportAudit(workspaceId, context, {
      corpusId,
      mode: archiveResult.mode,
      imported: archiveResult.imported,
      updated: archiveResult.updated,
      skipped: archiveResult.skipped,
      errors: archiveResult.errors.length,
    });

    return archiveResult;
  }

  async importCorpusPortableZip(
    workspaceId: string,
    corpusId: string,
    zipBuffer: Buffer,
  ): Promise<PortableImportResult> {
    const rawEntries = parseZipUpload(zipBuffer);
    const resolved = resolveArchiveImport(rawEntries);
    if (resolved.mode !== 'portable') {
      throw ApiError.validation('Portable archive is missing .evukb/manifest.json.');
    }
    return this.importCorpusPortableFromEntries(workspaceId, corpusId, resolved.entries);
  }

  async importCorpusPortableFromEntries(
    workspaceId: string,
    corpusId: string,
    safeEntries: Map<string, Uint8Array>,
  ): Promise<PortableImportResult> {
    await this.#requireCorpus(workspaceId, corpusId);

    const result: PortableImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      linksRestored: 0,
      indexed: 0,
      warnings: [],
      errors: [],
    };

    const manifestBytes = safeEntries.get(portableManifestPath);
    if (!manifestBytes) {
      throw ApiError.validation('Portable archive is missing .evukb/manifest.json.');
    }

    const manifest = parsePortableManifestJson(new TextDecoder().decode(manifestBytes));
    const nodeIdMap = new Map<string, string>();
    const pathToNodeId = new Map<string, string>();
    const indexNodeIds: string[] = [];

    for (const exportNode of manifest.nodes) {
      const relativePath = buildFilePath(exportNode.path, exportNode.name);
      const expectedHash = manifest.checksums[relativePath];
      if (!expectedHash) {
        result.errors.push(`${relativePath}: missing checksum in manifest.`);
        continue;
      }

      const zipPath = portableFileZipPath(relativePath);
      const fileBytes = safeEntries.get(zipPath);
      if (!fileBytes) {
        result.errors.push(`${relativePath}: missing file entry in archive.`);
        continue;
      }

      const actualHash = sha256Hex(fileBytes);
      if (actualHash !== expectedHash) {
        result.errors.push(`${relativePath}: checksum mismatch.`);
        continue;
      }

      if (actualHash !== exportNode.contentHash) {
        result.warnings.push(`${relativePath}: manifest node hash differs from checksum map.`);
      }

      try {
        const { parentPath, name } = splitRelativeFilePath(relativePath);
        await ensureFolderChain(this.#nodes, workspaceId, corpusId, parentPath, {
          sourceType: 'import',
          buildSourceRef: portableSourceRef,
        });
        const parentId = await resolveParentId(this.#nodes, workspaceId, corpusId, parentPath);
        const sourceRef = portableSourceRef(relativePath);
        const occupying = await this.#nodes.getByIdInWorkspace(workspaceId, exportNode.id);
        const canUsePreferredId =
          !occupying ||
          (occupying.corpusId === corpusId &&
            occupying.path === exportNode.path &&
            occupying.name === exportNode.name);

        const metadata = {
          ...exportNode.metadata,
          importProvenance: {
            exportedAt: manifest.exportedAt,
            sourceCorpusName: manifest.corpus.name,
            relativePath,
          },
        };

        const upserted = await this.#nodes.upsertPortableFile({
          workspaceId,
          corpusId,
          parentId,
          path: exportNode.path,
          name,
          ...(canUsePreferredId ? { preferredNodeId: exportNode.id } : {}),
          sourceRef,
          storageRelPath: importedBlobRelPath(exportNode.id),
          contentHash: actualHash,
          mimeType: exportNode.mimeType,
          sizeBytes: fileBytes.byteLength,
          metadata,
        });

        const storageRelPath = importedBlobRelPath(upserted.node.id);
        const blobRef = createBlobRef(
          asWorkspaceId(workspaceId),
          asCorpusId(corpusId),
          storageRelPath,
        );
        await this.#blobStore.put({
          ref: blobRef,
          body: Buffer.from(fileBytes),
          contentHash: actualHash,
        });

        if (upserted.node.storageRelPath !== storageRelPath) {
          await this.#nodes.updateContent(workspaceId, corpusId, upserted.node.id, {
            contentHash: actualHash,
            mimeType: exportNode.mimeType ?? null,
            sizeBytes: fileBytes.byteLength,
            storageRelPath,
          });
        }

        if (!upserted.preferredIdUsed && exportNode.id) {
          result.warnings.push(
            `${relativePath}: could not preserve node id ${exportNode.id}; assigned ${upserted.node.id}.`,
          );
        }

        if (upserted.outcome === 'created') {
          result.imported += 1;
        } else if (upserted.outcome === 'updated') {
          result.updated += 1;
        } else {
          result.skipped += 1;
        }

        nodeIdMap.set(exportNode.id, upserted.node.id);
        pathToNodeId.set(relativePath, upserted.node.id);

        if (isMarkdownFile(name, exportNode.mimeType)) {
          indexNodeIds.push(upserted.node.id);
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error
            ? `${relativePath}: ${error.message}`
            : `${relativePath}: import failed`,
        );
      }
    }

    const linksBySource = new Map<string, typeof manifest.links>();
    for (const link of manifest.links) {
      const mappedFrom = nodeIdMap.get(link.fromNodeId);
      if (!mappedFrom) {
        result.warnings.push(`Skipped link from unknown node ${link.fromNodeId}.`);
        continue;
      }
      const bucket = linksBySource.get(mappedFrom) ?? [];
      bucket.push(link);
      linksBySource.set(mappedFrom, bucket);
    }

    for (const [fromNodeId, sourceLinks] of linksBySource) {
      const createLinks = sourceLinks.map((link) => {
        let toNodeId = link.toNodeId ? (nodeIdMap.get(link.toNodeId) ?? null) : null;
        if (!toNodeId && link.targetPath) {
          toNodeId = pathToNodeId.get(link.targetPath) ?? null;
        }
        const resolved = link.externalUrl ? link.resolved : Boolean(toNodeId);
        return {
          workspaceId,
          corpusId,
          fromNodeId,
          toNodeId,
          linkKind: link.linkKind,
          raw: link.raw,
          targetPath: link.targetPath,
          externalUrl: link.externalUrl,
          resolved,
          metadata: link.metadata,
        };
      });

      await this.#links.replaceForNode(workspaceId, corpusId, fromNodeId, createLinks);
      result.linksRestored += createLinks.length;
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
