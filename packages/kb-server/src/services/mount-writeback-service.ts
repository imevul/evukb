import { mkdir, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  isImportWritebackEnabled,
  isPathWithinRoot,
  type KnowledgeNode,
  parseCorpusSyncSettings,
  resolveAllowedMountPath,
  resolveManagedMountRelativePath,
  shouldWritebackManagedNode,
} from '@evu/kb-core';
import type { CorpusRepository } from '@evu/kb-db';

export type MountWritebackServiceDeps = {
  corpora: CorpusRepository;
  mountAllowlist: string[];
  env?: Record<string, string | undefined>;
};

type WritebackTarget = {
  mountRoot: string;
  targetPath: string;
};

export class MountWritebackService {
  readonly #corpora: CorpusRepository;
  readonly #mountAllowlist: string[];
  readonly #env: Record<string, string | undefined>;

  constructor(deps: MountWritebackServiceDeps) {
    this.#corpora = deps.corpora;
    this.#mountAllowlist = deps.mountAllowlist;
    this.#env = deps.env ?? process.env;
  }

  async #resolveWritebackTarget(
    workspaceId: string,
    corpusId: string,
    node: KnowledgeNode,
  ): Promise<WritebackTarget | null> {
    if (!isImportWritebackEnabled(this.#env)) {
      return null;
    }
    if (!shouldWritebackManagedNode(node)) {
      return null;
    }

    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      return null;
    }

    const syncSettings = parseCorpusSyncSettings(corpus.settings);
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

    const relativePath = resolveManagedMountRelativePath(node);
    const targetPath = path.join(resolved.resolved, relativePath);
    if (!isPathWithinRoot(resolved.resolved, targetPath)) {
      return null;
    }
    if (!(await realPathStaysWithinRoot(resolved.resolved, targetPath))) {
      return null;
    }

    return { mountRoot: resolved.resolved, targetPath };
  }

  async maybeWritebackManagedFile(
    workspaceId: string,
    corpusId: string,
    node: KnowledgeNode,
    content: Buffer,
  ): Promise<void> {
    const target = await this.#resolveWritebackTarget(workspaceId, corpusId, node);
    if (!target) {
      return;
    }

    await mkdir(path.dirname(target.targetPath), { recursive: true });
    await writeFile(target.targetPath, content);
  }

  async maybeDeleteWritebackManagedFile(
    workspaceId: string,
    corpusId: string,
    node: KnowledgeNode,
  ): Promise<void> {
    const target = await this.#resolveWritebackTarget(workspaceId, corpusId, node);
    if (!target) {
      return;
    }

    await unlink(target.targetPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

/**
 * Symlink defense: resolves the target (or, when it does not exist yet, its
 * closest existing ancestor) and requires the real path to stay inside the
 * real mount root. Lexical checks alone miss symlinks planted on the mount.
 */
async function realPathStaysWithinRoot(mountRoot: string, targetPath: string): Promise<boolean> {
  let resolvedRoot: string;
  try {
    resolvedRoot = await realpath(mountRoot);
  } catch {
    return false;
  }

  let current = targetPath;
  while (true) {
    try {
      const resolved = await realpath(current);
      return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return false;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return false;
      }
      current = parent;
    }
  }
}
