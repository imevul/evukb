import {
  asCorpusId,
  asNodeId,
  asWorkspaceId,
  type IndexStatus,
  type KnowledgeNode,
  type NodeSourceType,
  type NodeType,
} from '@evu/kb-core';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

import type { DbHandle } from '../client.js';
import { knowledgeNodes } from '../schema/knowledge.js';

function mapNodeRow(row: typeof knowledgeNodes.$inferSelect): KnowledgeNode {
  return {
    id: asNodeId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    corpusId: asCorpusId(row.corpusId),
    parentId: row.parentId ? asNodeId(row.parentId) : null,
    path: row.path,
    name: row.name,
    nodeType: row.nodeType as NodeType,
    storageRelPath: row.storageRelPath,
    sourceType: row.sourceType as NodeSourceType,
    sourceRef: row.sourceRef,
    contentHash: row.contentHash,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    indexStatus: row.indexStatus as IndexStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    indexedAt: row.indexedAt,
  };
}

export type CreateNodeInput = {
  workspaceId: string;
  corpusId: string;
  parentId?: string | null;
  path: string;
  name: string;
  nodeType: NodeType;
  storageRelPath?: string | null;
  sourceType?: NodeSourceType;
  sourceRef?: string | null;
  mimeType?: string | null;
  contentHash?: string | null;
  sizeBytes?: number;
  indexStatus?: IndexStatus;
};

export class NodeRepository {
  readonly #db: DbHandle['db'];

  constructor(handle: DbHandle) {
    this.#db = handle.db;
  }

  async listByCorpus(workspaceId: string, corpusId: string): Promise<KnowledgeNode[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(eq(knowledgeNodes.workspaceId, workspaceId), eq(knowledgeNodes.corpusId, corpusId)),
      );

    return rows.map(mapNodeRow);
  }

  async getById(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.id, nodeId),
        ),
      )
      .limit(1);

    return row ? mapNodeRow(row) : null;
  }

  async getByIdInWorkspace(workspaceId: string, nodeId: string): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(and(eq(knowledgeNodes.workspaceId, workspaceId), eq(knowledgeNodes.id, nodeId)))
      .limit(1);

    return row ? mapNodeRow(row) : null;
  }

  async listByIds(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
  ): Promise<KnowledgeNode[]> {
    if (nodeIds.length === 0) {
      return [];
    }

    const rows = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          inArray(knowledgeNodes.id, nodeIds),
        ),
      );

    return rows.map(mapNodeRow);
  }

  async getByPathAndName(
    workspaceId: string,
    corpusId: string,
    nodePath: string,
    name: string,
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.path, nodePath),
          eq(knowledgeNodes.name, name),
        ),
      )
      .limit(1);

    return row ? mapNodeRow(row) : null;
  }

  async updatePathsForPrefix(
    workspaceId: string,
    corpusId: string,
    oldPrefix: string,
    newPrefix: string,
  ): Promise<void> {
    const nodes = await this.listByCorpus(workspaceId, corpusId);
    for (const node of nodes) {
      if (node.path === oldPrefix || node.path.startsWith(`${oldPrefix}/`)) {
        const suffix = node.path === oldPrefix ? '' : node.path.slice(oldPrefix.length + 1);
        const nextPath = newPrefix ? (suffix ? `${newPrefix}/${suffix}` : newPrefix) : suffix;
        await this.#db
          .update(knowledgeNodes)
          .set({ path: nextPath, updatedAt: sql`now()` })
          .where(
            and(
              eq(knowledgeNodes.workspaceId, workspaceId),
              eq(knowledgeNodes.corpusId, corpusId),
              eq(knowledgeNodes.id, node.id),
            ),
          );
      }
    }
  }

  async getBySourceRef(
    workspaceId: string,
    corpusId: string,
    sourceType: NodeSourceType,
    sourceRef: string,
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.sourceType, sourceType),
          eq(knowledgeNodes.sourceRef, sourceRef),
        ),
      )
      .limit(1);

    return row ? mapNodeRow(row) : null;
  }

  async listSyncedByCorpus(
    workspaceId: string,
    corpusId: string,
    sourceType?: NodeSourceType,
  ): Promise<KnowledgeNode[]> {
    const conditions = [
      eq(knowledgeNodes.workspaceId, workspaceId),
      eq(knowledgeNodes.corpusId, corpusId),
      eq(knowledgeNodes.nodeType, 'file'),
    ];
    if (sourceType) {
      conditions.push(eq(knowledgeNodes.sourceType, sourceType));
    } else {
      conditions.push(inArray(knowledgeNodes.sourceType, ['shared_mount', 'git', 'reference']));
    }

    const rows = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(and(...conditions));

    return rows.map(mapNodeRow);
  }

  async upsertSyncedFile(input: {
    workspaceId: string;
    corpusId: string;
    parentId: string | null;
    path: string;
    name: string;
    sourceType: NodeSourceType;
    sourceRef: string;
    storageRelPath: string;
    contentHash: string;
    mimeType?: string | null;
    sizeBytes: number;
    changed: boolean;
  }): Promise<KnowledgeNode> {
    const existing = await this.getBySourceRef(
      input.workspaceId,
      input.corpusId,
      input.sourceType,
      input.sourceRef,
    );

    if (existing) {
      if (!input.changed && existing.contentHash === input.contentHash) {
        return existing;
      }

      const [row] = await this.#db
        .update(knowledgeNodes)
        .set({
          parentId: input.parentId,
          path: input.path,
          name: input.name,
          storageRelPath: input.storageRelPath,
          contentHash: input.contentHash,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes,
          indexStatus: 'pending',
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(knowledgeNodes.workspaceId, input.workspaceId),
            eq(knowledgeNodes.corpusId, input.corpusId),
            eq(knowledgeNodes.id, existing.id),
          ),
        )
        .returning();

      if (!row) {
        throw new Error('Failed to update synced file node.');
      }
      return mapNodeRow(row);
    }

    const [row] = await this.#db
      .insert(knowledgeNodes)
      .values({
        workspaceId: input.workspaceId,
        corpusId: input.corpusId,
        parentId: input.parentId,
        path: input.path,
        name: input.name,
        nodeType: 'file',
        storageRelPath: input.storageRelPath,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        contentHash: input.contentHash,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes,
        indexStatus: 'pending',
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create synced file node.');
    }

    return mapNodeRow(row);
  }

  async upsertPortableFile(input: {
    workspaceId: string;
    corpusId: string;
    parentId: string | null;
    path: string;
    name: string;
    preferredNodeId?: string;
    sourceRef: string;
    storageRelPath: string;
    contentHash: string;
    mimeType?: string | null;
    sizeBytes: number;
    metadata: Record<string, unknown>;
  }): Promise<{
    node: KnowledgeNode;
    outcome: 'created' | 'updated' | 'unchanged';
    preferredIdUsed: boolean;
  }> {
    const existing = await this.getBySourceRef(
      input.workspaceId,
      input.corpusId,
      'import',
      input.sourceRef,
    );

    if (existing) {
      if (existing.contentHash === input.contentHash) {
        return {
          node: existing,
          outcome: 'unchanged',
          preferredIdUsed: existing.id === input.preferredNodeId,
        };
      }

      const [row] = await this.#db
        .update(knowledgeNodes)
        .set({
          parentId: input.parentId,
          path: input.path,
          name: input.name,
          storageRelPath: input.storageRelPath,
          contentHash: input.contentHash,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes,
          metadata: input.metadata,
          indexStatus: 'pending',
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(knowledgeNodes.workspaceId, input.workspaceId),
            eq(knowledgeNodes.corpusId, input.corpusId),
            eq(knowledgeNodes.id, existing.id),
          ),
        )
        .returning();

      if (!row) {
        throw new Error('Failed to update portable import file node.');
      }
      return {
        node: mapNodeRow(row),
        outcome: 'updated',
        preferredIdUsed: existing.id === input.preferredNodeId,
      };
    }

    const byPath = await this.getByPathAndName(
      input.workspaceId,
      input.corpusId,
      input.path,
      input.name,
    );
    if (byPath) {
      if (byPath.contentHash === input.contentHash) {
        return {
          node: byPath,
          outcome: 'unchanged',
          preferredIdUsed: byPath.id === input.preferredNodeId,
        };
      }

      const [row] = await this.#db
        .update(knowledgeNodes)
        .set({
          sourceType: 'import',
          sourceRef: input.sourceRef,
          storageRelPath: input.storageRelPath,
          contentHash: input.contentHash,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes,
          metadata: input.metadata,
          indexStatus: 'pending',
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(knowledgeNodes.workspaceId, input.workspaceId),
            eq(knowledgeNodes.corpusId, input.corpusId),
            eq(knowledgeNodes.id, byPath.id),
          ),
        )
        .returning();

      if (!row) {
        throw new Error('Failed to update portable import file node by path.');
      }
      return {
        node: mapNodeRow(row),
        outcome: 'updated',
        preferredIdUsed: byPath.id === input.preferredNodeId,
      };
    }

    let preferredIdUsed = false;
    let insertId: string | undefined;

    if (input.preferredNodeId) {
      const occupying = await this.getByIdInWorkspace(input.workspaceId, input.preferredNodeId);
      if (
        !occupying ||
        (occupying.corpusId === input.corpusId &&
          occupying.path === input.path &&
          occupying.name === input.name)
      ) {
        insertId = input.preferredNodeId;
        preferredIdUsed = true;
      }
    }

    const [row] = await this.#db
      .insert(knowledgeNodes)
      .values({
        ...(insertId ? { id: insertId } : {}),
        workspaceId: input.workspaceId,
        corpusId: input.corpusId,
        parentId: input.parentId,
        path: input.path,
        name: input.name,
        nodeType: 'file',
        storageRelPath: input.storageRelPath,
        sourceType: 'import',
        sourceRef: input.sourceRef,
        contentHash: input.contentHash,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes,
        metadata: input.metadata,
        indexStatus: 'pending',
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create portable import file node.');
    }

    return {
      node: mapNodeRow(row),
      outcome: 'created',
      preferredIdUsed,
    };
  }

  async ensureSyncedFolder(input: {
    workspaceId: string;
    corpusId: string;
    path: string;
    name: string;
    sourceType: NodeSourceType;
    sourceRef: string;
  }): Promise<KnowledgeNode> {
    const existing = await this.getByPathAndName(
      input.workspaceId,
      input.corpusId,
      input.path,
      input.name,
    );
    if (existing) {
      return existing;
    }

    let parentId: string | null = null;
    if (input.path) {
      const parentName = input.path.split('/').pop();
      const parentFolderPath = input.path.includes('/')
        ? input.path.slice(0, input.path.lastIndexOf('/'))
        : '';
      if (parentName) {
        const parent = await this.getByPathAndName(
          input.workspaceId,
          input.corpusId,
          parentFolderPath,
          parentName,
        );
        parentId = parent?.id ?? null;
      }
    }

    return this.create({
      workspaceId: input.workspaceId,
      corpusId: input.corpusId,
      parentId,
      path: input.path,
      name: input.name,
      nodeType: 'folder',
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      indexStatus: 'indexed',
    });
  }

  async deleteSyncedNodesNotInRefs(
    workspaceId: string,
    corpusId: string,
    sourceTypes: NodeSourceType[],
    keepSourceRefs: Set<string>,
  ): Promise<KnowledgeNode[]> {
    const synced = await this.listSyncedByCorpus(workspaceId, corpusId);
    const toDelete = synced.filter(
      (node) =>
        sourceTypes.includes(node.sourceType) &&
        node.sourceRef &&
        !keepSourceRefs.has(node.sourceRef),
    );

    if (toDelete.length === 0) {
      return [];
    }

    await this.deleteMany(
      workspaceId,
      corpusId,
      toDelete.map((node) => node.id),
    );
    return toDelete;
  }

  async deleteManagedFilesNotInPaths(
    workspaceId: string,
    corpusId: string,
    keepRelativePaths: Set<string>,
  ): Promise<KnowledgeNode[]> {
    const nodes = await this.listByCorpus(workspaceId, corpusId);
    const toDelete = nodes.filter((node) => {
      if (node.nodeType !== 'file' || node.sourceType !== 'managed') {
        return false;
      }
      const relativePath = node.path ? `${node.path}/${node.name}` : node.name;
      return !keepRelativePaths.has(relativePath);
    });

    if (toDelete.length === 0) {
      return [];
    }

    await this.deleteMany(
      workspaceId,
      corpusId,
      toDelete.map((node) => node.id),
    );
    return toDelete;
  }

  async create(input: CreateNodeInput): Promise<KnowledgeNode> {
    const [row] = await this.#db
      .insert(knowledgeNodes)
      .values({
        workspaceId: input.workspaceId,
        corpusId: input.corpusId,
        parentId: input.parentId ?? null,
        path: input.path,
        name: input.name,
        nodeType: input.nodeType,
        storageRelPath: input.storageRelPath ?? null,
        sourceType: input.sourceType ?? 'managed',
        sourceRef: input.sourceRef ?? null,
        mimeType: input.mimeType ?? null,
        contentHash: input.contentHash ?? null,
        sizeBytes: input.sizeBytes ?? 0,
        indexStatus: input.indexStatus ?? 'pending',
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create knowledge node.');
    }

    return mapNodeRow(row);
  }

  async updateContent(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: {
      contentHash: string;
      mimeType?: string | null;
      sizeBytes: number;
      storageRelPath: string;
    },
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .update(knowledgeNodes)
      .set({
        contentHash: input.contentHash,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes,
        storageRelPath: input.storageRelPath,
        indexStatus: 'pending',
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.id, nodeId),
        ),
      )
      .returning();

    return row ? mapNodeRow(row) : null;
  }

  async rename(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    name: string,
    path: string,
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .update(knowledgeNodes)
      .set({
        name,
        path,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.id, nodeId),
        ),
      )
      .returning();

    return row ? mapNodeRow(row) : null;
  }

  async move(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: { parentId: string | null; path: string },
  ): Promise<KnowledgeNode | null> {
    const [row] = await this.#db
      .update(knowledgeNodes)
      .set({
        parentId: input.parentId,
        path: input.path,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.id, nodeId),
        ),
      )
      .returning();

    return row ? mapNodeRow(row) : null;
  }

  async deleteMany(workspaceId: string, corpusId: string, nodeIds: string[]): Promise<number> {
    if (nodeIds.length === 0) {
      return 0;
    }

    const deleted = await this.#db
      .delete(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          inArray(knowledgeNodes.id, nodeIds),
        ),
      )
      .returning({ id: knowledgeNodes.id });

    return deleted.length;
  }

  async updateIndexStatus(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    input: {
      indexStatus: IndexStatus;
      metadata?: Record<string, unknown>;
      indexedAt?: string | null;
    },
  ): Promise<KnowledgeNode | null> {
    const existing = await this.getById(workspaceId, corpusId, nodeId);
    const [row] = await this.#db
      .update(knowledgeNodes)
      .set({
        indexStatus: input.indexStatus,
        metadata: input.metadata ?? existing?.metadata ?? {},
        indexedAt: input.indexedAt ?? null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.id, nodeId),
        ),
      )
      .returning();

    return row ? mapNodeRow(row) : null;
  }

  async listIndexableFilesByCorpus(
    workspaceId: string,
    corpusId: string,
  ): Promise<KnowledgeNode[]> {
    const rows = await this.#db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.workspaceId, workspaceId),
          eq(knowledgeNodes.corpusId, corpusId),
          eq(knowledgeNodes.nodeType, 'file'),
          or(
            sql`${knowledgeNodes.name} ILIKE ${'%.md'}`,
            eq(knowledgeNodes.mimeType, 'text/markdown'),
            eq(knowledgeNodes.mimeType, 'text/x-markdown'),
          ),
        ),
      );

    return rows.map(mapNodeRow);
  }
}
