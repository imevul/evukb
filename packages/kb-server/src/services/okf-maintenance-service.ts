import {
  appendLogEntryToContent,
  buildFilePath,
  buildInitialLogBody,
  buildSynthesizedIndexBody,
  classifyOkfFile,
  descriptionFromMarkdown,
  folderPathsForMaintenanceEvent,
  formatLogEntry,
  isOkfCorpus,
  mergeIndexIncremental,
  type OkfIndexNodeRef,
  type OkfLogMaintenanceActor,
  type OkfMaintenanceEventKind,
  parentFolderPathFromFilePath,
  titleFromMarkdown,
  utcDateString,
} from '@evu/kb-core';
import type { CorpusRepository, NodeRepository } from '@evu/kb-db';

import type { FileManagerService } from './file-manager.js';
import type { OkfMaintenanceEvent } from './okf-maintenance-types.js';

export type { OkfMaintenanceEvent } from './okf-maintenance-types.js';

export type OkfMaintenanceServiceDeps = {
  corpora: CorpusRepository;
  fileManager: FileManagerService;
  nodes: NodeRepository;
};

function isConceptMarkdown(fileName: string): boolean {
  return classifyOkfFile(fileName) === 'concept';
}

function childFolderNamesFromNodes(
  nodes: OkfIndexNodeRef[],
  folderPath: string,
): Array<{ name: string; title: string }> {
  const prefix = folderPath.length > 0 ? `${folderPath}/` : '';
  const names = new Set<string>();
  for (const node of nodes) {
    if (classifyOkfFile(node.name) !== 'concept') {
      continue;
    }
    if (folderPath.length === 0) {
      if (node.path.includes('/')) {
        names.add(node.path.split('/')[0] ?? '');
      }
      continue;
    }
    if (!node.path.startsWith(prefix)) {
      continue;
    }
    const remainder = node.path.slice(prefix.length);
    if (remainder.includes('/')) {
      names.add(remainder.split('/')[0] ?? '');
    }
  }
  return [...names]
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, title: name }));
}

function conceptsInFolder(nodes: OkfIndexNodeRef[], folderPath: string) {
  return nodes
    .filter((node) => classifyOkfFile(node.name) === 'concept' && node.path === folderPath)
    .map((node) => ({
      name: node.name,
      title: node.content
        ? titleFromMarkdown(node.content, node.name)
        : node.name.replace(/\.md$/i, ''),
      description: node.content ? descriptionFromMarkdown(node.content) : null,
    }));
}

function logKindFromEvent(kind: OkfMaintenanceEventKind): 'create' | 'update' | 'delete' | null {
  if (kind === 'create') {
    return 'create';
  }
  if (kind === 'update') {
    return 'update';
  }
  if (kind === 'delete') {
    return 'delete';
  }
  if (kind === 'move') {
    return 'update';
  }
  return null;
}

export class OkfMaintenanceService {
  readonly #corpora: CorpusRepository;
  readonly #fileManager: FileManagerService;
  readonly #nodes: NodeRepository;

  constructor(deps: OkfMaintenanceServiceDeps) {
    this.#corpora = deps.corpora;
    this.#fileManager = deps.fileManager;
    this.#nodes = deps.nodes;
  }

  async maintainForEvent(
    workspaceId: string,
    corpusId: string,
    event: OkfMaintenanceEvent,
    actor: OkfLogMaintenanceActor = { kind: 'admin' },
  ): Promise<{ indexNodeIds: string[]; logNodeId: string | null }> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus || !isOkfCorpus(corpus.settings)) {
      return { indexNodeIds: [], logNodeId: null };
    }

    const baseName = event.filePath.split('/').pop() ?? '';
    if (event.nodeType !== 'folder' && !isConceptMarkdown(baseName)) {
      return { indexNodeIds: [], logNodeId: null };
    }

    const indexNodeIds: string[] = [];
    const folderPaths = folderPathsForMaintenanceEvent({
      kind: event.kind,
      filePath: event.filePath,
      ...(event.previousFilePath !== undefined ? { previousFilePath: event.previousFilePath } : {}),
      ...(event.nodeType !== undefined ? { nodeType: event.nodeType } : {}),
    });

    const allNodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const indexRefs: OkfIndexNodeRef[] = [];
    for (const node of allNodes) {
      if (node.nodeType !== 'file' || !node.storageRelPath) {
        continue;
      }
      let content: string | undefined;
      if (classifyOkfFile(node.name) === 'concept' || classifyOkfFile(node.name) === 'index') {
        try {
          content = (
            await this.#fileManager.readContent(workspaceId, corpusId, node.id)
          ).content.toString('utf8');
        } catch {
          content = undefined;
        }
      }
      indexRefs.push({
        path: node.path,
        name: node.name,
        ...(content !== undefined ? { content } : {}),
        metadata: node.metadata,
      });
    }

    for (const folderPath of folderPaths) {
      const maintainedIndex = await this.#maintainFolderIndex(
        workspaceId,
        corpusId,
        folderPath,
        indexRefs,
        event,
      );
      if (maintainedIndex) {
        indexNodeIds.push(maintainedIndex);
      }
    }

    const logNodeId = await this.#maintainFolderLog(workspaceId, corpusId, event, actor);

    return { indexNodeIds, logNodeId };
  }

  async #maintainFolderIndex(
    workspaceId: string,
    corpusId: string,
    folderPath: string,
    indexRefs: OkfIndexNodeRef[],
    event: OkfMaintenanceEvent,
  ): Promise<string | null> {
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const indexNode = nodes.find(
      (node) =>
        node.nodeType === 'file' &&
        node.name.toLowerCase() === 'index.md' &&
        node.path === folderPath,
    );

    const concepts = conceptsInFolder(indexRefs, folderPath);
    const subfolders = childFolderNamesFromNodes(indexRefs, folderPath);

    if (concepts.length === 0 && subfolders.length === 0 && event.kind !== 'delete') {
      return null;
    }

    const fileName = event.filePath.includes('/')
      ? event.filePath.slice(event.filePath.lastIndexOf('/') + 1)
      : event.filePath;
    const title =
      event.title ??
      (event.content ? titleFromMarkdown(event.content, fileName) : fileName.replace(/\.md$/i, ''));
    const description = event.content ? descriptionFromMarkdown(event.content) : null;

    let nextBody: string;
    if (!indexNode) {
      if (event.kind === 'delete') {
        return null;
      }
      nextBody = buildSynthesizedIndexBody(concepts, subfolders);
      const created = await this.#fileManager.createFileInternal(workspaceId, corpusId, {
        path: folderPath,
        name: 'index.md',
        content: Buffer.from(nextBody, 'utf8'),
        mimeType: 'text/markdown',
      });
      return created.id;
    }

    const { content } = await this.#fileManager.readContent(workspaceId, corpusId, indexNode.id);
    if (event.kind === 'delete' && concepts.length === 0 && subfolders.length === 0) {
      nextBody = mergeIndexIncremental({
        content: content.toString('utf8'),
        event: {
          kind: 'delete',
          fileName,
          title,
          description,
        },
      });
    } else if (concepts.length === 0 && subfolders.length === 0) {
      return null;
    } else {
      nextBody = mergeIndexIncremental({
        content: content.toString('utf8'),
        event: {
          kind: event.kind,
          fileName,
          title,
          description,
        },
      });
    }

    await this.#fileManager.saveContentInternal(workspaceId, corpusId, indexNode.id, {
      content: Buffer.from(nextBody, 'utf8'),
    });
    return indexNode.id;
  }

  async #maintainFolderLog(
    workspaceId: string,
    corpusId: string,
    event: OkfMaintenanceEvent,
    actor: OkfLogMaintenanceActor,
  ): Promise<string | null> {
    const logKind = logKindFromEvent(event.kind);
    if (!logKind) {
      return null;
    }

    const folderPath = parentFolderPathFromFilePath(event.filePath);
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    let logNode = nodes.find(
      (node) =>
        node.nodeType === 'file' &&
        node.name.toLowerCase() === 'log.md' &&
        node.path === folderPath,
    );

    const entryLine = formatLogEntry({
      kind: logKind,
      filePath: event.filePath,
      ...(event.title !== undefined ? { title: event.title } : {}),
      actor,
    });
    const dateUtc = utcDateString();

    if (!logNode) {
      const initial = appendLogEntryToContent({
        content: buildInitialLogBody(),
        entryLine,
        dateUtc,
      });
      logNode = await this.#fileManager.createFileInternal(workspaceId, corpusId, {
        path: folderPath,
        name: 'log.md',
        content: Buffer.from(initial, 'utf8'),
        mimeType: 'text/markdown',
      });
      return logNode.id;
    }

    const { content } = await this.#fileManager.readContent(workspaceId, corpusId, logNode.id);
    const next = appendLogEntryToContent({
      content: content.toString('utf8'),
      entryLine,
      dateUtc,
    });
    await this.#fileManager.saveContentInternal(workspaceId, corpusId, logNode.id, {
      content: Buffer.from(next, 'utf8'),
    });
    return logNode.id;
  }
}

export function kbWriteActorToLogActor(actor: {
  kind: string;
  tokenId?: string;
}): OkfLogMaintenanceActor {
  if (actor.kind === 'mcp_token' || actor.kind === 'api_key') {
    const tokenId = actor.tokenId ?? 'unknown';
    return { kind: 'agent', agentId: tokenId, runId: tokenId };
  }
  return { kind: 'admin' };
}

export function nodeFilePath(node: { path: string; name: string }): string {
  return buildFilePath(node.path, node.name);
}
