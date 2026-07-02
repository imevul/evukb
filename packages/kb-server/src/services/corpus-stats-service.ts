import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildFilePath,
  buildMarkdownPathToNodeIdMap,
  countCitationValidationIssues,
  countOkfValidationIssues,
  emptyIndexStatusCounts,
  formatWritebackDriftSummary,
  type IndexStatus,
  isInternalLink,
  isMarkdownNode,
  isOkfCorpus,
  type KnowledgeCorpusStats,
  type KnowledgeNode,
  mountContentMatchesKb,
  parseCorpusSyncSettings,
  resolveAllowedMountPath,
  resolveImportKind,
  resolveInternalLinkTarget,
  resolveManagedMountRelativePath,
  resolveStoredInternalLink,
  shouldWritebackManagedNode,
  targetPathCandidates,
} from '@evu/kb-core';
import type { CorpusRepository, LinkRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';

export type CorpusStatsServiceDeps = {
  corpora: CorpusRepository;
  jobQueue?: JobQueueService;
  links: LinkRepository;
  mountAllowlist?: string[];
  nodes: NodeRepository;
};

export class CorpusStatsService {
  readonly #corpora: CorpusRepository;
  readonly #jobQueue: JobQueueService | undefined;
  readonly #links: LinkRepository;
  readonly #mountAllowlist: string[];
  readonly #nodes: NodeRepository;

  constructor(deps: CorpusStatsServiceDeps) {
    this.#corpora = deps.corpora;
    this.#jobQueue = deps.jobQueue;
    this.#links = deps.links;
    this.#mountAllowlist = deps.mountAllowlist ?? [];
    this.#nodes = deps.nodes;
  }

  async getCorpusStats(workspaceId: string, corpusId: string): Promise<KnowledgeCorpusStats> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }

    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const markdownFiles = nodes.filter(isMarkdownNode);
    const indexStatusCounts = emptyIndexStatusCounts();
    for (const node of markdownFiles) {
      indexStatusCounts[node.indexStatus as IndexStatus] += 1;
    }

    const linkCounts = await this.#links.countByResolution(workspaceId, corpusId);
    const warnings: string[] = [];

    const failedCount = indexStatusCounts.failed;
    if (failedCount > 0) {
      warnings.push(`${failedCount} markdown file${failedCount === 1 ? '' : 's'} failed indexing.`);
    }

    const pendingCount = indexStatusCounts.pending + indexStatusCounts.stale;
    if (pendingCount > 0) {
      warnings.push(
        `${pendingCount} markdown file${pendingCount === 1 ? '' : 's'} need reindexing.`,
      );
    }

    if (linkCounts.unresolved > 0) {
      const linkLabel = linkCounts.unresolved === 1 ? 'link remains' : 'links remain';
      warnings.push(`${linkCounts.unresolved} internal ${linkLabel} unresolved.`);
    }

    const okfIssueCount = isOkfCorpus(corpus.settings)
      ? countOkfValidationIssues(markdownFiles)
      : 0;
    if (okfIssueCount > 0) {
      warnings.push(
        okfIssueCount === 1
          ? '1 OKF markdown file has validation issues.'
          : `${okfIssueCount} OKF markdown files have validation issues.`,
      );
    }

    const citationIssueCount = isOkfCorpus(corpus.settings)
      ? countCitationValidationIssues(markdownFiles)
      : 0;
    if (citationIssueCount > 0) {
      warnings.push(
        citationIssueCount === 1
          ? '1 OKF file has citation URL validation issues.'
          : `${citationIssueCount} OKF files have citation URL validation issues.`,
      );
    }

    const jobCounts = this.#jobQueue
      ? await this.#jobQueue.countCorpusJobs(workspaceId, corpusId)
      : { pendingJobCount: 0, failedJobCount: 0 };
    if (jobCounts.pendingJobCount > 0) {
      warnings.push(
        `${jobCounts.pendingJobCount} background job${jobCounts.pendingJobCount === 1 ? '' : 's'} pending.`,
      );
    }
    if (jobCounts.failedJobCount > 0) {
      warnings.push(
        `${jobCounts.failedJobCount} background job${jobCounts.failedJobCount === 1 ? '' : 's'} failed.`,
      );
    }

    const syncSettings = parseCorpusSyncSettings(corpus.settings);
    const importKind = resolveImportKind(corpus.settings);
    if (importKind === 'mount' || importKind === 'git') {
      if (!syncSettings.syncStatus?.lastSyncAt) {
        warnings.push('Sync has never run for this corpus.');
      } else if (syncSettings.syncStatus.lastSyncStatus === 'failed') {
        warnings.push(syncSettings.syncStatus.lastSyncError ?? 'Last sync failed.');
      }
    }

    const driftWarning = await this.#scanWritebackDrift(corpus.settings, markdownFiles);
    if (driftWarning) {
      warnings.push(driftWarning);
    }

    return {
      corpusId: corpus.id,
      workspaceId: corpus.workspaceId,
      fileCount: corpus.fileCount,
      chunkCount: corpus.chunkCount,
      totalBytes: corpus.totalBytes,
      indexStatusCounts,
      linkCounts,
      okfIssueCount,
      citationIssueCount,
      pendingJobCount: jobCounts.pendingJobCount,
      failedJobCount: jobCounts.failedJobCount,
      importKind,
      ...(syncSettings.syncStatus ? { syncStatus: syncSettings.syncStatus } : {}),
      warnings,
      updatedAt: new Date().toISOString(),
    };
  }

  async #scanWritebackDrift(
    settings: Record<string, unknown>,
    nodes: KnowledgeNode[],
  ): Promise<string | null> {
    const syncSettings = parseCorpusSyncSettings(settings);
    if (syncSettings.importKind !== 'mount' || syncSettings.mountMode !== 'import_writeback') {
      return null;
    }
    if (!syncSettings.mountPath) {
      return null;
    }

    const resolved = resolveAllowedMountPath(syncSettings.mountPath, this.#mountAllowlist);
    if ('error' in resolved) {
      return null;
    }

    const driftPaths: string[] = [];
    for (const node of nodes) {
      if (!shouldWritebackManagedNode(node)) {
        continue;
      }
      const relativePath = resolveManagedMountRelativePath(node);
      const targetPath = path.join(resolved.resolved, relativePath);
      let mountSha256: string;
      try {
        const content = await readFile(targetPath);
        mountSha256 = createHash('sha256').update(content).digest('hex');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(
            `EvuKB: writeback drift scan could not read mount file ${targetPath}:`,
            error instanceof Error ? error.message : error,
          );
        }
        continue;
      }
      if (!mountContentMatchesKb(node.contentHash, mountSha256)) {
        driftPaths.push(relativePath);
      }
    }

    if (driftPaths.length === 0) {
      return null;
    }
    return formatWritebackDriftSummary(driftPaths.length, driftPaths);
  }
}

export async function reconcileCorpusLinkResolution(
  links: LinkRepository,
  nodes: NodeRepository,
  workspaceId: string,
  corpusId: string,
): Promise<number> {
  const corpusNodes = await nodes.listByCorpus(workspaceId, corpusId);
  const pathToNodeId = buildMarkdownPathToNodeIdMap(corpusNodes.filter(isMarkdownNode));
  const allLinks = await links.listByCorpus(workspaceId, corpusId);
  const updates = allLinks
    .filter(isInternalLink)
    .map((link) => {
      const resolution = resolveStoredInternalLink(link, pathToNodeId);
      if (resolution.toNodeId === link.toNodeId && resolution.resolved === link.resolved) {
        return null;
      }
      return {
        id: link.id,
        toNodeId: resolution.toNodeId,
        resolved: resolution.resolved,
      };
    })
    .filter((update): update is NonNullable<typeof update> => update != null);

  if (updates.length > 0) {
    await links.updateResolutionBatch(workspaceId, corpusId, updates);
  }

  return updates.length;
}

export function resolveParsedLinksForIndex(
  parsedLinks: Array<{
    linkKind: import('@evu/kb-core').LinkKind;
    raw: string;
    targetPath: string | null;
    externalUrl: string | null;
  }>,
  pathToNodeId: Map<string, string>,
  workspaceId: string,
  corpusId: string,
  fromNodeId: string,
) {
  return parsedLinks.map((link) => {
    const resolution = resolveInternalLinkTarget(link, pathToNodeId);
    return {
      workspaceId,
      corpusId,
      fromNodeId,
      linkKind: link.linkKind,
      raw: link.raw,
      targetPath: link.targetPath,
      externalUrl: link.externalUrl,
      toNodeId: resolution.toNodeId,
      resolved: resolution.resolved,
    };
  });
}

export { buildFilePath, targetPathCandidates };
