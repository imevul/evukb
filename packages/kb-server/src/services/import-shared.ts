import { createHash } from 'node:crypto';

import {
  assertArchiveZipImportLimits,
  assertPortableFileEntry,
  isPortableManifestEntry,
  type NodeSourceType,
  portableFileZipPath,
  portableManifestPath,
} from '@evu/kb-core';
import type { CorpusRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import { resolveArchiveImportLimits } from '../limits.js';

/** Shared helpers for the archive, portable, and sync import pipelines. */

export function sha256Hex(content: Buffer | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Blob path for files created through the file manager or generic archive import. */
export function managedBlobRelPath(nodeId: string): string {
  return `managed/${nodeId}`;
}

/** Blob path for files created through portable or sync imports. */
export function importedBlobRelPath(nodeId: string): string {
  return `import/${nodeId}`;
}

export function isMarkdownFile(name: string, mimeType: string | null): boolean {
  if (name.toLowerCase().endsWith('.md')) {
    return true;
  }
  return mimeType === 'text/markdown' || mimeType === 'text/x-markdown';
}

export type FolderChainOptions = {
  sourceType: NodeSourceType;
  buildSourceRef: (relativePath: string) => string;
};

export async function ensureFolderChain(
  nodes: NodeRepository,
  workspaceId: string,
  corpusId: string,
  folderPath: string,
  options: FolderChainOptions,
): Promise<void> {
  if (!folderPath) {
    return;
  }

  const segments = folderPath.split('/').filter(Boolean);
  let currentPath = '';
  for (const segment of segments) {
    const parentPath = currentPath;
    const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
    await nodes.ensureSyncedFolder({
      workspaceId,
      corpusId,
      path: parentPath,
      name: segment,
      sourceType: options.sourceType,
      sourceRef: options.buildSourceRef(nextPath),
    });
    currentPath = nextPath;
  }
}

export async function resolveParentId(
  nodes: NodeRepository,
  workspaceId: string,
  corpusId: string,
  parentPath: string,
): Promise<string | null> {
  if (!parentPath) {
    return null;
  }
  const parentName = parentPath.split('/').pop();
  const parentFolderPath = parentPath.includes('/')
    ? parentPath.slice(0, parentPath.lastIndexOf('/'))
    : '';
  if (!parentName) {
    return null;
  }
  const parent = await nodes.getByPathAndName(workspaceId, corpusId, parentFolderPath, parentName);
  return parent?.id ?? null;
}

export async function refreshCorpusFileStats(
  corpora: CorpusRepository,
  nodes: NodeRepository,
  workspaceId: string,
  corpusId: string,
): Promise<void> {
  const corpus = await corpora.getById(workspaceId, corpusId);
  if (!corpus) {
    return;
  }
  const allNodes = await nodes.listByCorpus(workspaceId, corpusId);
  const files = allNodes.filter((node) => node.nodeType === 'file');
  await corpora.refreshStats(workspaceId, corpusId, {
    fileCount: files.length,
    chunkCount: corpus.chunkCount,
    totalBytes: files.reduce((sum, node) => sum + node.sizeBytes, 0),
  });
}

/** Maps raw zip entries onto safe portable paths, rejecting traversal attempts. */
export function filterPortableZipEntries(
  entries: Record<string, Uint8Array>,
): Map<string, Uint8Array> {
  const safeEntries = new Map<string, Uint8Array>();
  for (const [entryName, body] of Object.entries(entries)) {
    if (entryName.endsWith('/')) {
      continue;
    }
    if (isPortableManifestEntry(entryName)) {
      safeEntries.set(portableManifestPath, body);
      continue;
    }
    const relativePath = assertPortableFileEntry(entryName);
    safeEntries.set(portableFileZipPath(relativePath), body);
  }
  return safeEntries;
}

export function assertPortableZipImportLimits(entries: Record<string, Uint8Array>): void {
  try {
    assertArchiveZipImportLimits(entries, resolveArchiveImportLimits());
  } catch (error) {
    if (error instanceof Error && error.name === 'ArchiveImportLimitError') {
      throw ApiError.validation(error.message);
    }
    throw error;
  }
}
