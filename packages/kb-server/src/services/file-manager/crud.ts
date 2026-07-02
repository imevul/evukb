import {
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  buildFilePath,
  classifyOkfFile,
  createBlobRef,
  type KnowledgeNode,
  resolveNodeMutability,
} from '@evu/kb-core';
import type { AuditLogRepository, CorpusRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../../errors.js';
import type { CorpusIndexEventHub } from '../corpus-index-event-hub.js';
import { managedBlobRelPath, sha256Hex } from '../import-shared.js';
import type { MountWritebackService } from '../mount-writeback-service.js';
import {
  buildNodePath,
  buildNodeTree,
  collectDescendants,
  normalizeFolderPath,
  normalizeNodeName,
  streamToBuffer,
} from './helpers.js';
import { applyMarkdownMetadata, assertOkfStrictAllowsSave, notifyOkfMutation } from './okf.js';
import type {
  FileContentInput,
  FileManagerDeps,
  FileMutationContext,
  NodeTreeEntry,
} from './types.js';
import {
  maybeDeleteWritebackManagedFile,
  maybeWritebackManagedFile,
  notifyContentChanged,
  recordAudit,
} from './writeback-hooks.js';

export class FileManagerService {
  readonly #auditLog: AuditLogRepository | undefined;
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #indexEventHub: CorpusIndexEventHub | undefined;
  readonly #nodes: NodeRepository;
  readonly #mountWriteback: MountWritebackService | undefined;
  readonly #onContentChanged?: FileManagerDeps['onContentChanged'];
  readonly #onOkfMutation?: FileManagerDeps['onOkfMutation'];

  constructor(deps: FileManagerDeps) {
    this.#auditLog = deps.auditLog;
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#indexEventHub = deps.indexEventHub;
    this.#nodes = deps.nodes;
    this.#mountWriteback = deps.mountWriteback;
    this.#onContentChanged = deps.onContentChanged;
    this.#onOkfMutation = deps.onOkfMutation;
  }

  async #recordAudit(
    workspaceId: string,
    context: FileMutationContext,
    action: string,
    target: Record<string, unknown>,
  ): Promise<void> {
    await recordAudit(this.#auditLog, workspaceId, context, action, target);
  }

  async #maybeWritebackManagedFile(
    workspaceId: string,
    corpusId: string,
    node: KnowledgeNode,
    content: Buffer,
  ): Promise<void> {
    await maybeWritebackManagedFile(this.#mountWriteback, workspaceId, corpusId, node, content);
  }

  async #maybeDeleteWritebackManagedFile(
    workspaceId: string,
    corpusId: string,
    node: KnowledgeNode,
  ): Promise<void> {
    await maybeDeleteWritebackManagedFile(this.#mountWriteback, workspaceId, corpusId, node);
  }

  async #requireCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    return corpus;
  }

  async #requireNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<KnowledgeNode> {
    const node = await this.#nodes.getById(workspaceId, corpusId, nodeId);
    if (!node) {
      throw ApiError.nodeNotFound(nodeId);
    }
    return node;
  }

  async listNodes(
    workspaceId: string,
    corpusId: string,
    format: 'flat' | 'tree' = 'flat',
  ): Promise<KnowledgeNode[] | NodeTreeEntry[]> {
    await this.#requireCorpus(workspaceId, corpusId);
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    if (format === 'flat') {
      return nodes;
    }
    return buildNodeTree(nodes);
  }

  async createFolder(
    workspaceId: string,
    corpusId: string,
    input: { path: string; name: string },
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    await this.#requireCorpus(workspaceId, corpusId);
    const parentPath = normalizeFolderPath(input.path);
    const name = normalizeNodeName(input.name);

    const existing = await this.#nodes.getByPathAndName(workspaceId, corpusId, parentPath, name);
    if (existing) {
      throw ApiError.conflict(
        `A node already exists at path "${buildNodePath(parentPath, name)}".`,
      );
    }

    let parentId: string | null = null;
    if (parentPath) {
      const parentName = parentPath.split('/').pop();
      const parentFolderPath = parentPath.includes('/')
        ? parentPath.slice(0, parentPath.lastIndexOf('/'))
        : '';
      if (!parentName) {
        throw ApiError.validation('Invalid parent path.');
      }
      const parent = await this.#nodes.getByPathAndName(
        workspaceId,
        corpusId,
        parentFolderPath,
        parentName,
      );
      if (parent?.nodeType !== 'folder') {
        throw ApiError.validation(`Parent folder not found: ${parentPath}`);
      }
      parentId = parent.id;
    }

    const folder = await this.#nodes.create({
      workspaceId,
      corpusId,
      parentId,
      path: parentPath,
      name,
      nodeType: 'folder',
      sourceType: 'managed',
    });

    await this.#recordAudit(workspaceId, context, 'create_folder', {
      corpusId,
      nodeId: folder.id,
      path: buildNodePath(parentPath, name),
    });

    return folder;
  }

  async createFile(
    workspaceId: string,
    corpusId: string,
    input: { path: string; name: string; content: Buffer; mimeType?: string | null },
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    const parentPath = normalizeFolderPath(input.path);
    const name = normalizeNodeName(input.name);

    const existing = await this.#nodes.getByPathAndName(workspaceId, corpusId, parentPath, name);
    if (existing) {
      throw ApiError.conflict(
        `A file already exists at path "${buildNodePath(parentPath, name)}".`,
      );
    }

    if (!context.internal) {
      assertOkfStrictAllowsSave(corpus.settings, input.name, input.content);
    }

    let parentId: string | null = null;
    if (parentPath) {
      const parentName = parentPath.split('/').pop();
      const parentFolderPath = parentPath.includes('/')
        ? parentPath.slice(0, parentPath.lastIndexOf('/'))
        : '';
      if (!parentName) {
        throw ApiError.validation('Invalid parent path.');
      }
      const parent = await this.#nodes.getByPathAndName(
        workspaceId,
        corpusId,
        parentFolderPath,
        parentName,
      );
      if (parent?.nodeType !== 'folder') {
        throw ApiError.validation(`Parent folder not found: ${parentPath}`);
      }
      parentId = parent.id;
    }

    const node = await this.#nodes.create({
      workspaceId,
      corpusId,
      parentId,
      path: parentPath,
      name,
      nodeType: 'file',
      sourceType: 'managed',
      mimeType: input.mimeType ?? null,
      sizeBytes: input.content.byteLength,
      indexStatus: 'pending',
    });

    const storageRelPath = managedBlobRelPath(node.id);
    const contentHash = sha256Hex(input.content);
    const blobRef = createBlobRef(asWorkspaceId(workspaceId), asCorpusId(corpusId), storageRelPath);
    await this.#blobStore.put({ ref: blobRef, body: input.content, contentHash });

    const updated = await this.#nodes.updateContent(workspaceId, corpusId, node.id, {
      contentHash,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.content.byteLength,
      storageRelPath,
    });
    if (!updated) {
      throw new ApiError('internal_error', 'Failed to persist uploaded file metadata.', 500);
    }

    await this.#maybeWritebackManagedFile(workspaceId, corpusId, updated, input.content);

    await applyMarkdownMetadata(
      { nodes: this.#nodes, indexEventHub: this.#indexEventHub },
      workspaceId,
      corpusId,
      updated.id,
      corpus.settings,
      input.content,
    );

    if (!context.internal) {
      await notifyOkfMutation(
        this.#onOkfMutation,
        workspaceId,
        corpusId,
        {
          kind: 'create',
          filePath: buildFilePath(parentPath, name),
          content: input.content.toString('utf8'),
        },
        context.okfActor,
      );
    }

    await this.#recordAudit(workspaceId, context, 'create_file', {
      corpusId,
      nodeId: updated.id,
      path: buildFilePath(parentPath, name),
    });

    await notifyContentChanged(this.#onContentChanged, workspaceId, corpusId, updated.id);
    return (await this.#requireNode(workspaceId, corpusId, updated.id)) ?? updated;
  }

  async createFileInternal(
    workspaceId: string,
    corpusId: string,
    input: { path: string; name: string; content: Buffer; mimeType?: string | null },
  ): Promise<KnowledgeNode> {
    return this.createFile(workspaceId, corpusId, input, { internal: true });
  }

  async #assertEditable(node: KnowledgeNode): Promise<void> {
    const mutability = resolveNodeMutability(node);
    if (!mutability.editable) {
      throw ApiError.forbidden(mutability.reason ?? 'Node is read-only.');
    }
  }

  async readContent(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<{ node: KnowledgeNode; content: Buffer }> {
    const node = await this.#requireNode(workspaceId, corpusId, nodeId);
    if (node.nodeType !== 'file') {
      throw ApiError.validation('Node is not a file.');
    }
    if (!node.storageRelPath) {
      throw ApiError.validation('File storage path is missing.');
    }

    const blobRef = createBlobRef(
      asWorkspaceId(workspaceId),
      asCorpusId(corpusId),
      node.storageRelPath,
    );
    const stream = await this.#blobStore.get(blobRef);
    const content = await streamToBuffer(stream);
    return { node, content };
  }

  async appendContent(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: { body: string; mimeType?: string | null },
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    const { content } = await this.readContent(workspaceId, corpusId, nodeId);
    const existing = content.toString('utf8');
    const append = input.body;
    let combined: string;
    if (existing.length === 0) {
      combined = append;
    } else if (append.length === 0) {
      combined = existing;
    } else {
      const needsSeparator = !existing.endsWith('\n') && !append.startsWith('\n');
      combined = needsSeparator ? `${existing}\n${append}` : `${existing}${append}`;
    }

    return this.saveContent(
      workspaceId,
      corpusId,
      nodeId,
      {
        content: Buffer.from(combined, 'utf8'),
        ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
      },
      context,
    );
  }

  async saveContent(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: FileContentInput,
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    const node = await this.#requireNode(workspaceId, corpusId, nodeId);
    if (node.nodeType !== 'file') {
      throw ApiError.validation('Node is not a file.');
    }
    await this.#assertEditable(node);

    if (!context.internal) {
      assertOkfStrictAllowsSave(corpus.settings, node.name, input.content);
    }

    const storageRelPath = node.storageRelPath ?? managedBlobRelPath(node.id);
    const contentHash = sha256Hex(input.content);
    const blobRef = createBlobRef(asWorkspaceId(workspaceId), asCorpusId(corpusId), storageRelPath);
    await this.#blobStore.put({ ref: blobRef, body: input.content, contentHash });

    const updated = await this.#nodes.updateContent(workspaceId, corpusId, nodeId, {
      contentHash,
      mimeType: input.mimeType ?? node.mimeType,
      sizeBytes: input.content.byteLength,
      storageRelPath,
    });
    if (!updated) {
      throw ApiError.nodeNotFound(nodeId);
    }

    await this.#maybeWritebackManagedFile(workspaceId, corpusId, updated, input.content);

    await applyMarkdownMetadata(
      { nodes: this.#nodes, indexEventHub: this.#indexEventHub },
      workspaceId,
      corpusId,
      nodeId,
      corpus.settings,
      input.content,
    );

    if (!context.internal && classifyOkfFile(updated.name) === 'concept') {
      await notifyOkfMutation(
        this.#onOkfMutation,
        workspaceId,
        corpusId,
        {
          kind: 'update',
          filePath: buildFilePath(updated.path, updated.name),
          content: input.content.toString('utf8'),
        },
        context.okfActor,
      );
    }

    await this.#recordAudit(workspaceId, context, 'save_file', {
      corpusId,
      nodeId,
      path: buildFilePath(updated.path, updated.name),
    });

    await notifyContentChanged(this.#onContentChanged, workspaceId, corpusId, nodeId);
    return (await this.#requireNode(workspaceId, corpusId, nodeId)) ?? updated;
  }

  async saveContentInternal(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: FileContentInput,
  ): Promise<KnowledgeNode> {
    return this.saveContent(workspaceId, corpusId, nodeId, input, { internal: true });
  }

  async renameNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    name: string,
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    const node = await this.#requireNode(workspaceId, corpusId, nodeId);
    await this.#assertEditable(node);
    const trimmed = normalizeNodeName(name);
    const previousFilePath = buildFilePath(node.path, node.name);

    const duplicate = await this.#nodes.getByPathAndName(workspaceId, corpusId, node.path, trimmed);
    if (duplicate && duplicate.id !== node.id) {
      throw ApiError.conflict(`A node already exists with name "${trimmed}" in this folder.`);
    }

    if (node.nodeType === 'folder') {
      const oldFullPath = buildNodePath(node.path, node.name);
      const newFullPath = buildNodePath(node.path, trimmed);
      await this.#nodes.updatePathsForPrefix(workspaceId, corpusId, oldFullPath, newFullPath);
    }

    const updated = await this.#nodes.rename(workspaceId, corpusId, nodeId, trimmed, node.path);
    if (!updated) {
      throw ApiError.nodeNotFound(nodeId);
    }

    if (!context.internal && classifyOkfFile(updated.name) === 'concept') {
      await notifyOkfMutation(
        this.#onOkfMutation,
        workspaceId,
        corpusId,
        {
          kind: 'move',
          filePath: buildFilePath(updated.path, updated.name),
          previousFilePath,
        },
        context.okfActor,
      );
    }

    await this.#recordAudit(workspaceId, context, 'rename_node', {
      corpusId,
      nodeId,
      path: buildFilePath(updated.path, updated.name),
      previousPath: previousFilePath,
    });

    return updated;
  }

  async moveNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    targetPath: string,
    context: FileMutationContext = {},
  ): Promise<KnowledgeNode> {
    const node = await this.#requireNode(workspaceId, corpusId, nodeId);
    await this.#assertEditable(node);
    const previousFilePath = buildFilePath(node.path, node.name);
    const parentPath = normalizeFolderPath(targetPath);

    let parentId: string | null = null;
    if (parentPath) {
      const parentName = parentPath.split('/').pop();
      const parentFolderPath = parentPath.includes('/')
        ? parentPath.slice(0, parentPath.lastIndexOf('/'))
        : '';
      if (!parentName) {
        throw ApiError.validation('Invalid target path.');
      }
      const parent = await this.#nodes.getByPathAndName(
        workspaceId,
        corpusId,
        parentFolderPath,
        parentName,
      );
      if (parent?.nodeType !== 'folder') {
        throw ApiError.validation(`Target folder not found: ${parentPath}`);
      }
      if (
        node.nodeType === 'folder' &&
        (parent.id === node.id || parent.path.startsWith(buildNodePath(node.path, node.name)))
      ) {
        throw ApiError.validation('Cannot move a folder into itself or its descendants.');
      }
      parentId = parent.id;
    }

    const duplicate = await this.#nodes.getByPathAndName(
      workspaceId,
      corpusId,
      parentPath,
      node.name,
    );
    if (duplicate && duplicate.id !== node.id) {
      throw ApiError.conflict(`A node already exists at the target location.`);
    }

    if (node.nodeType === 'folder') {
      const oldFullPath = buildNodePath(node.path, node.name);
      const newFullPath = buildNodePath(parentPath, node.name);
      await this.#nodes.updatePathsForPrefix(workspaceId, corpusId, oldFullPath, newFullPath);
    }

    const updated = await this.#nodes.move(workspaceId, corpusId, nodeId, {
      parentId,
      path: parentPath,
    });
    if (!updated) {
      throw ApiError.nodeNotFound(nodeId);
    }

    if (!context.internal && classifyOkfFile(updated.name) === 'concept') {
      await notifyOkfMutation(
        this.#onOkfMutation,
        workspaceId,
        corpusId,
        {
          kind: 'move',
          filePath: buildFilePath(updated.path, updated.name),
          previousFilePath,
        },
        context.okfActor,
      );
    }

    await this.#recordAudit(workspaceId, context, 'move_node', {
      corpusId,
      nodeId,
      path: buildFilePath(updated.path, updated.name),
      previousPath: previousFilePath,
    });

    return updated;
  }

  async deleteNodes(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
    context: FileMutationContext = {},
  ): Promise<{ deleted: number }> {
    await this.#requireCorpus(workspaceId, corpusId);
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const toDelete = new Set<string>();

    for (const nodeId of nodeIds) {
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) {
        continue;
      }
      collectDescendants(node, nodes, toDelete);
    }

    if (!context.internal) {
      for (const node of nodes) {
        if (!toDelete.has(node.id)) {
          continue;
        }
        await this.#assertEditable(node);
      }
    }

    if (!context.internal) {
      for (const node of nodes) {
        if (!toDelete.has(node.id) || node.nodeType !== 'file') {
          continue;
        }
        if (classifyOkfFile(node.name) !== 'concept') {
          continue;
        }
        await notifyOkfMutation(
          this.#onOkfMutation,
          workspaceId,
          corpusId,
          {
            kind: 'delete',
            filePath: buildFilePath(node.path, node.name),
          },
          context.okfActor,
        );
      }
    }

    for (const node of nodes) {
      if (!toDelete.has(node.id) || node.nodeType !== 'file') {
        continue;
      }
      await this.#maybeDeleteWritebackManagedFile(workspaceId, corpusId, node);
    }

    for (const node of nodes) {
      if (!toDelete.has(node.id)) {
        continue;
      }
      if (node.nodeType === 'file' && node.storageRelPath) {
        const blobRef = createBlobRef(
          asWorkspaceId(workspaceId),
          asCorpusId(corpusId),
          node.storageRelPath,
        );
        await this.#blobStore.delete(blobRef).catch(() => undefined);
      }
    }

    const deleted = await this.#nodes.deleteMany(workspaceId, corpusId, [...toDelete]);

    await this.#recordAudit(workspaceId, context, 'delete_nodes', {
      corpusId,
      nodeIds,
      deleted,
    });

    return { deleted };
  }

  async deleteCorpusBlobs(workspaceId: string, corpusId: string): Promise<void> {
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    for (const node of nodes) {
      if (node.nodeType === 'file' && node.storageRelPath) {
        const blobRef = createBlobRef(
          asWorkspaceId(workspaceId),
          asCorpusId(corpusId),
          node.storageRelPath,
        );
        await this.#blobStore.delete(blobRef).catch(() => undefined);
      }
    }
    await this.#nodes.deleteMany(
      workspaceId,
      corpusId,
      nodes.map((node) => node.id),
    );
  }
}
