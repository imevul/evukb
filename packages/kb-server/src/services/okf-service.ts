import {
  buildFilePath,
  classifyOkfFile,
  extractConceptFrontmatter,
  injectOkfTypeIntoMarkdown,
  isMarkdownNode,
  isOkfCorpus,
  type KnowledgeNode,
  mergeCorpusSettings,
  type OkfConceptSummary,
  type OkfConvertResult,
  type OkfIndexNodeRef,
  type OkfListConceptsResult,
  type OkfReadIndexResult,
  parseFrontmatter,
  resolveOkfIndexFolderPath,
  synthesizeMissingIndexes,
} from '@evu/kb-core';
import type { CorpusRepository, NodeRepository } from '@evu/kb-db';
import { zipSync } from 'fflate';

import { ApiError } from '../errors.js';
import type { FileManagerService } from './file-manager.js';
import type { IndexService } from './index-service.js';

export type OkfServiceDeps = {
  corpora: CorpusRepository;
  fileManager: FileManagerService;
  indexService: IndexService;
  nodes: NodeRepository;
};

export type ConvertCorpusToOkfOptions = {
  dryRun?: boolean;
  synthesizeIndex?: boolean;
};

export type ListConceptsOptions = {
  pathPrefix?: string;
  conceptType?: string;
  tag?: string;
  limit?: number;
  offset?: number;
};

function isManagedMarkdown(node: KnowledgeNode): boolean {
  return (
    node.nodeType === 'file' &&
    node.sourceType === 'managed' &&
    (node.name.toLowerCase().endsWith('.md') ||
      node.mimeType === 'text/markdown' ||
      node.mimeType === 'text/x-markdown')
  );
}

function toIndexNodeRef(node: KnowledgeNode, content?: string): OkfIndexNodeRef {
  return {
    path: node.path,
    name: node.name,
    ...(content !== undefined ? { content } : {}),
    metadata: node.metadata,
  };
}

function conceptIdFromNode(node: KnowledgeNode): string {
  return buildFilePath(node.path, node.name).replace(/\.md$/i, '');
}

function matchesPathPrefix(node: KnowledgeNode, pathPrefix?: string): boolean {
  if (!pathPrefix?.trim()) {
    return true;
  }
  const normalized = pathPrefix.trim().replace(/^\//, '').replace(/\/$/, '');
  const filePath = buildFilePath(node.path, node.name);
  return filePath.startsWith(`${normalized}/`) || filePath === normalized;
}

export class OkfService {
  readonly #corpora: CorpusRepository;
  readonly #fileManager: FileManagerService;
  readonly #indexService: IndexService;
  readonly #nodes: NodeRepository;

  constructor(deps: OkfServiceDeps) {
    this.#corpora = deps.corpora;
    this.#fileManager = deps.fileManager;
    this.#indexService = deps.indexService;
    this.#nodes = deps.nodes;
  }

  async convertCorpusToOkf(
    workspaceId: string,
    corpusId: string,
    options: ConvertCorpusToOkfOptions = {},
  ): Promise<OkfConvertResult> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    const dryRun = options.dryRun ?? false;
    const result: OkfConvertResult = {
      dryRun,
      updated: 0,
      skipped: 0,
      warnings: [],
      readOnlyBlocked: [],
    };

    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const indexRefs: OkfIndexNodeRef[] = [];

    for (const node of nodes) {
      if (!isManagedMarkdown(node)) {
        continue;
      }

      const role = classifyOkfFile(node.name);
      if (role === 'index' || role === 'log' || role === 'non_md') {
        result.skipped += 1;
        if (role !== 'non_md') {
          indexRefs.push(toIndexNodeRef(node));
        }
        continue;
      }

      const filePath = buildFilePath(node.path, node.name);
      let content: string;
      try {
        content = (
          await this.#fileManager.readContent(workspaceId, corpusId, node.id)
        ).content.toString('utf8');
      } catch {
        result.skipped += 1;
        continue;
      }

      indexRefs.push(toIndexNodeRef(node, content));
      const frontmatter = parseFrontmatter(content);
      const typeVal = frontmatter.parsed.type;
      if (typeof typeVal === 'string' && typeVal.trim().length > 0) {
        result.skipped += 1;
        continue;
      }

      if (node.sourceType !== 'managed') {
        result.readOnlyBlocked.push(filePath);
        result.warnings.push(`Read-only source; cannot write ${filePath}.`);
        continue;
      }

      if (dryRun) {
        result.updated += 1;
        continue;
      }

      const nextContent = injectOkfTypeIntoMarkdown(
        content,
        filePath,
        frontmatter.parsed,
        frontmatter.body,
        frontmatter.raw.length > 0,
      );
      await this.#fileManager.saveContent(workspaceId, corpusId, node.id, {
        content: Buffer.from(nextContent, 'utf8'),
      });
      result.updated += 1;
    }

    if (!dryRun) {
      await this.#corpora.update(workspaceId, corpusId, {
        settings: mergeCorpusSettings(corpus.settings, { formatProfile: 'okf' }),
      });
    }

    if (options.synthesizeIndex) {
      const synthesized = synthesizeMissingIndexes(indexRefs);
      if (dryRun) {
        result.updated += synthesized.length;
      } else {
        for (const index of synthesized) {
          const created = await this.#fileManager.createFile(workspaceId, corpusId, {
            path: index.folderPath,
            name: 'index.md',
            content: Buffer.from(index.body, 'utf8'),
            mimeType: 'text/markdown',
          });
          await this.#indexService.indexNode(workspaceId, corpusId, created.id);
          result.updated += 1;
        }
      }
    }

    return result;
  }

  async exportCorpusOkfZip(
    workspaceId: string,
    corpusId: string,
  ): Promise<{ zip: Buffer; fileName: string }> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    if (!isOkfCorpus(corpus.settings)) {
      throw ApiError.validation('Corpus is not configured with OKF format profile.');
    }

    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const zipEntries: Record<string, Uint8Array> = {};

    for (const node of nodes) {
      if (node.nodeType !== 'file' || node.sourceType !== 'managed' || !node.storageRelPath) {
        continue;
      }
      const { content } = await this.#fileManager.readContent(workspaceId, corpusId, node.id);
      const rel = buildFilePath(node.path, node.name);
      zipEntries[rel] = new Uint8Array(content);
    }

    const safeName =
      corpus.name
        .trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '') || corpusId;
    return {
      zip: Buffer.from(zipSync(zipEntries)),
      fileName: `${safeName}-okf.zip`,
    };
  }

  async readIndex(
    workspaceId: string,
    corpusId: string,
    documentPath?: string,
  ): Promise<OkfReadIndexResult> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    if (!isOkfCorpus(corpus.settings)) {
      throw ApiError.validation('Corpus is not configured with OKF format profile.');
    }

    const folderPath = resolveOkfIndexFolderPath(documentPath);
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const indexNode = nodes.find(
      (node) =>
        node.nodeType === 'file' &&
        node.name.toLowerCase() === 'index.md' &&
        node.path === folderPath,
    );

    if (!indexNode?.storageRelPath) {
      return {
        corpusId,
        directory: folderPath,
        content: null,
        synthesized: false,
      };
    }

    const { content } = await this.#fileManager.readContent(workspaceId, corpusId, indexNode.id);
    return {
      corpusId,
      directory: folderPath,
      nodeId: indexNode.id,
      content: content.toString('utf8'),
      synthesized: false,
    };
  }

  async listConcepts(
    workspaceId: string,
    corpusId: string,
    options: ListConceptsOptions = {},
  ): Promise<OkfListConceptsResult> {
    const corpus = await this.#requireCorpus(workspaceId, corpusId);
    if (!isOkfCorpus(corpus.settings)) {
      throw ApiError.validation('Corpus is not configured with OKF format profile.');
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const nodes = (await this.#nodes.listByCorpus(workspaceId, corpusId))
      .filter(isMarkdownNode)
      .filter((node) => classifyOkfFile(node.name) === 'concept')
      .filter((node) => matchesPathPrefix(node, options.pathPrefix));

    const concepts: OkfConceptSummary[] = [];
    for (const node of nodes) {
      let frontmatter = extractConceptFrontmatter(node.metadata);
      if (!frontmatter.type && node.indexStatus === 'pending') {
        try {
          const content = (
            await this.#fileManager.readContent(workspaceId, corpusId, node.id)
          ).content.toString('utf8');
          const parsed = parseFrontmatter(content).parsed;
          frontmatter = {
            type: typeof parsed.type === 'string' ? parsed.type : null,
            title: typeof parsed.title === 'string' ? parsed.title : null,
            tags: Array.isArray(parsed.tags)
              ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
              : [],
          };
        } catch {
          // Keep metadata-derived values when content cannot be read.
        }
      }

      if (options.conceptType && frontmatter.type !== options.conceptType) {
        continue;
      }
      if (options.tag && !frontmatter.tags.includes(options.tag)) {
        continue;
      }

      concepts.push({
        nodeId: node.id,
        conceptId: conceptIdFromNode(node),
        path: buildFilePath(node.path, node.name),
        type: frontmatter.type,
        title: frontmatter.title,
        tags: frontmatter.tags,
      });
    }

    return {
      corpusId: corpus.id,
      concepts: concepts.slice(offset, offset + limit),
      limit,
      offset,
    };
  }

  async #requireCorpus(workspaceId: string, corpusId: string) {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    return corpus;
  }
}
