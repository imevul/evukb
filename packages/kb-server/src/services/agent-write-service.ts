import {
  AgentWritePathError,
  joinAgentWritePath,
  type KbWriteActor,
  type KbWriteToolRequest,
  type KbWriteToolResponse,
  type KnowledgeNode,
  parseAgentWritePathPrefixes,
  prefixCovers,
  resolveAgentWritePathPrefixes,
  splitAgentWritePath,
  workspaceAgentWritePathPrefixes,
} from '@evu/kb-core';

import type {
  ApiKeyRepository,
  AuditLogRepository,
  CorpusRepository,
  McpTokenRepository,
  NodeRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { FileManagerService, FileMutationContext } from './file-manager.js';
import type { MutationApprovalService } from './mutation-approval-service.js';
import { kbWriteActorToLogActor } from './okf-maintenance-service.js';

export type AgentWriteServiceDeps = {
  auditLog: AuditLogRepository;
  fileManager: FileManagerService;
  nodes: NodeRepository;
  workspaces: WorkspaceRepository;
  corpora: CorpusRepository;
  apiKeys: ApiKeyRepository;
  mcpTokens: McpTokenRepository;
  mutationApproval?: MutationApprovalService | null;
};

function mapPathError(error: unknown): never {
  if (error instanceof AgentWritePathError) {
    throw ApiError.validation(error.message);
  }
  throw error;
}

function nodeDisplayPath(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

function writeContext(actor: KbWriteActor): FileMutationContext {
  return { okfActor: kbWriteActorToLogActor(actor) };
}

export class AgentWriteService {
  readonly #auditLog: AuditLogRepository;
  readonly #fileManager: FileManagerService;
  readonly #nodes: NodeRepository;
  readonly #workspaces: WorkspaceRepository;
  readonly #corpora: CorpusRepository;
  readonly #apiKeys: ApiKeyRepository;
  readonly #mcpTokens: McpTokenRepository;
  #mutationApproval: MutationApprovalService | null;

  constructor(deps: AgentWriteServiceDeps) {
    this.#auditLog = deps.auditLog;
    this.#fileManager = deps.fileManager;
    this.#nodes = deps.nodes;
    this.#workspaces = deps.workspaces;
    this.#corpora = deps.corpora;
    this.#apiKeys = deps.apiKeys;
    this.#mcpTokens = deps.mcpTokens;
    this.#mutationApproval = deps.mutationApproval ?? null;
  }

  setMutationApproval(service: MutationApprovalService): void {
    this.#mutationApproval = service;
  }

  async execute(
    workspaceId: string,
    actor: KbWriteActor,
    request: KbWriteToolRequest,
  ): Promise<KbWriteToolResponse> {
    if (this.#mutationApproval) {
      const pending = await this.#mutationApproval.maybeGateWrite(workspaceId, actor, request);
      if (pending) {
        return pending;
      }
    }
    return this.applyMutation(workspaceId, actor, request);
  }

  async applyMutation(
    workspaceId: string,
    actor: KbWriteActor,
    request: KbWriteToolRequest,
  ): Promise<KbWriteToolResponse> {
    switch (request.action) {
      case 'append_document':
        return this.appendDocument(workspaceId, actor, request);
      case 'create_document':
        return this.createDocument(workspaceId, actor, request);
      case 'update_document':
        return this.updateDocument(workspaceId, actor, request);
      case 'delete_document':
        return this.deleteDocument(workspaceId, actor, request);
      default:
        throw ApiError.validation('Unsupported kb tool action.');
    }
  }

  async appendDocument(
    workspaceId: string,
    actor: KbWriteActor,
    input: Extract<KbWriteToolRequest, { action: 'append_document' }>,
  ): Promise<KbWriteToolResponse> {
    const allowedPrefixes = await this.#resolveAllowedPrefixes(workspaceId, input.corpusId, actor);
    let folderPath: string;
    let name: string;
    try {
      ({ folderPath, name } = splitAgentWritePath(input.path, allowedPrefixes));
    } catch (error) {
      mapPathError(error);
    }

    await this.#ensureFolderChain(workspaceId, input.corpusId, folderPath);

    const existing = await this.#nodes.getByPathAndName(
      workspaceId,
      input.corpusId,
      folderPath,
      name,
    );

    let node: KnowledgeNode;
    if (existing) {
      if (existing.nodeType !== 'file') {
        throw ApiError.validation('Append target must be a file.');
      }
      node = await this.#fileManager.appendContent(
        workspaceId,
        input.corpusId,
        existing.id,
        {
          body: input.body,
        },
        writeContext(actor),
      );
    } else {
      node = await this.#fileManager.createFile(
        workspaceId,
        input.corpusId,
        {
          path: folderPath,
          name,
          content: Buffer.from(input.body, 'utf8'),
          mimeType: 'text/markdown',
        },
        writeContext(actor),
      );
    }

    const path = nodeDisplayPath(node.path, node.name);
    await this.#recordAudit(workspaceId, actor, 'append_document', {
      corpusId: input.corpusId,
      nodeId: node.id,
      path,
    });

    return { ok: true, action: 'append_document', nodeId: node.id, path };
  }

  async createDocument(
    workspaceId: string,
    actor: KbWriteActor,
    input: Extract<KbWriteToolRequest, { action: 'create_document' }>,
  ): Promise<KbWriteToolResponse> {
    const allowedPrefixes = await this.#resolveAllowedPrefixes(workspaceId, input.corpusId, actor);
    let folderPath: string;
    let fullPath: string;
    try {
      fullPath = joinAgentWritePath(input.path, input.name, allowedPrefixes);
      ({ folderPath } = splitAgentWritePath(fullPath, allowedPrefixes));
    } catch (error) {
      mapPathError(error);
    }

    await this.#ensureFolderChain(workspaceId, input.corpusId, folderPath);

    const node = await this.#fileManager.createFile(
      workspaceId,
      input.corpusId,
      {
        path: folderPath,
        name: input.name.trim(),
        content: Buffer.from(input.body, 'utf8'),
        mimeType: 'text/markdown',
      },
      writeContext(actor),
    );

    const path = nodeDisplayPath(node.path, node.name);
    await this.#recordAudit(workspaceId, actor, 'create_document', {
      corpusId: input.corpusId,
      nodeId: node.id,
      path,
    });

    return { ok: true, action: 'create_document', nodeId: node.id, path };
  }

  async updateDocument(
    workspaceId: string,
    actor: KbWriteActor,
    input: Extract<KbWriteToolRequest, { action: 'update_document' }>,
  ): Promise<KbWriteToolResponse> {
    const allowedPrefixes = await this.#resolveAllowedPrefixes(workspaceId, input.corpusId, actor);
    const existing = await this.#nodes.getById(workspaceId, input.corpusId, input.nodeId);
    if (!existing) {
      throw ApiError.nodeNotFound(input.nodeId);
    }
    const existingPath = nodeDisplayPath(existing.path, existing.name);
    try {
      const allowed = allowedPrefixes.some((prefix) => prefixCovers(prefix, existingPath));
      if (!allowed) {
        throw new AgentWritePathError(
          `Agent write path must be under one of: ${allowedPrefixes.join(', ')}`,
        );
      }
    } catch (error) {
      mapPathError(error);
    }

    const node = await this.#fileManager.saveContent(
      workspaceId,
      input.corpusId,
      input.nodeId,
      {
        content: Buffer.from(input.body, 'utf8'),
      },
      writeContext(actor),
    );

    const path = nodeDisplayPath(node.path, node.name);
    await this.#recordAudit(workspaceId, actor, 'update_document', {
      corpusId: input.corpusId,
      nodeId: node.id,
      path,
    });

    return { ok: true, action: 'update_document', nodeId: node.id, path };
  }

  async deleteDocument(
    workspaceId: string,
    actor: KbWriteActor,
    input: Extract<KbWriteToolRequest, { action: 'delete_document' }>,
  ): Promise<KbWriteToolResponse> {
    const allowedPrefixes = await this.#resolveAllowedPrefixes(workspaceId, input.corpusId, actor);
    const node = await this.#nodes.getById(workspaceId, input.corpusId, input.nodeId);
    if (!node) {
      throw ApiError.nodeNotFound(input.nodeId);
    }

    const path = nodeDisplayPath(node.path, node.name);
    try {
      const allowed = allowedPrefixes.some((prefix) => prefixCovers(prefix, path));
      if (!allowed) {
        throw new AgentWritePathError(
          `Agent write path must be under one of: ${allowedPrefixes.join(', ')}`,
        );
      }
    } catch (error) {
      mapPathError(error);
    }

    const { deleted } = await this.#fileManager.deleteNodes(
      workspaceId,
      input.corpusId,
      [input.nodeId],
      writeContext(actor),
    );

    await this.#recordAudit(workspaceId, actor, 'delete_document', {
      corpusId: input.corpusId,
      nodeId: input.nodeId,
      path,
      deleted,
    });

    return { ok: true, action: 'delete_document', nodeId: input.nodeId, path, deleted };
  }

  async #resolveAllowedPrefixes(
    workspaceId: string,
    corpusId: string,
    actor: KbWriteActor,
  ): Promise<string[]> {
    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      throw ApiError.notFound(`Workspace not found: ${workspaceId}`);
    }

    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }

    const workspacePrefixes = workspaceAgentWritePathPrefixes(workspace.settings);
    const corpusPrefixes = parseAgentWritePathPrefixes(corpus.settings.agentWritePathPrefixes);

    let tokenPrefixes: string[] | undefined;
    if (actor.kind === 'api_key') {
      const key = await this.#apiKeys.getById(workspaceId, actor.tokenId);
      tokenPrefixes = key?.writePathPrefixes ?? undefined;
    } else if (actor.kind === 'mcp_token') {
      const token = await this.#mcpTokens.getById(workspaceId, actor.tokenId);
      tokenPrefixes = token?.writePathPrefixes ?? undefined;
    }

    const resolved = resolveAgentWritePathPrefixes({
      workspacePrefixes,
      ...(corpusPrefixes ? { corpusPrefixes } : {}),
      ...(tokenPrefixes ? { tokenPrefixes } : {}),
    });

    if (resolved.length === 0) {
      throw ApiError.forbidden('No agent write path prefixes are configured for this actor.');
    }

    return resolved;
  }

  async #ensureFolderChain(
    workspaceId: string,
    corpusId: string,
    folderPath: string,
  ): Promise<void> {
    if (!folderPath) {
      return;
    }

    const parts = folderPath.split('/');
    let currentPath = '';
    for (const part of parts) {
      const parentPath = currentPath;
      const existing = await this.#nodes.getByPathAndName(workspaceId, corpusId, parentPath, part);
      if (existing) {
        if (existing.nodeType !== 'folder') {
          throw ApiError.validation(`Path segment is not a folder: ${part}`);
        }
      } else {
        await this.#fileManager.createFolder(workspaceId, corpusId, {
          path: parentPath,
          name: part,
        });
      }
      currentPath = currentPath ? `${currentPath}/${part}` : part;
    }
  }

  async #recordAudit(
    workspaceId: string,
    actor: KbWriteActor,
    action: string,
    target: Record<string, unknown>,
  ): Promise<void> {
    await this.#auditLog.record({
      workspaceId,
      action,
      actor,
      target,
    });
  }
}
