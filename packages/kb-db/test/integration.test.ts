import { randomUUID } from 'node:crypto';
import { asWorkspaceId } from '@evu/kb-core';
import { describe, expect, it } from 'vitest';
import {
  ChunkRepository,
  CorpusRepository,
  createDb,
  LinkRepository,
  migrateLatest,
  NodeRepository,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb('kb-db repositories', () => {
  it('scopes corpus reads to workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const corpus = await corpora.create({
        workspaceId: workspaceA.id,
        name: 'Primary Corpus',
      });

      await expect(corpora.getById(workspaceA.id, corpus.id)).resolves.toMatchObject({
        id: corpus.id,
        workspaceId: workspaceA.id,
      });
      await expect(corpora.getById(workspaceB.id, corpus.id)).resolves.toBeNull();
      await expect(corpora.listByWorkspace(workspaceB.id)).resolves.toEqual([]);

      expect(asWorkspaceId(workspaceA.id)).toBe(workspaceA.id);
    } finally {
      await handle.close();
    }
  });

  it('lists corpora ordered by createdAt ascending', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);

      const workspace = await workspaces.create({
        slug: `ws-order-${randomUUID()}`,
        name: 'Workspace Order',
      });

      const first = await corpora.create({
        workspaceId: workspace.id,
        name: 'First corpus',
      });
      const second = await corpora.create({
        workspaceId: workspace.id,
        name: 'Second corpus',
      });

      await expect(corpora.listByWorkspace(workspace.id)).resolves.toMatchObject([
        { id: first.id, name: 'First corpus' },
        { id: second.id, name: 'Second corpus' },
      ]);
    } finally {
      await handle.close();
    }
  });

  it('scopes node reads and writes to workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const corpus = await corpora.create({
        workspaceId: workspaceA.id,
        name: 'Primary Corpus',
      });

      const node = await nodes.create({
        workspaceId: workspaceA.id,
        corpusId: corpus.id,
        path: '',
        name: 'notes.md',
        nodeType: 'file',
      });

      await expect(nodes.getById(workspaceA.id, corpus.id, node.id)).resolves.toMatchObject({
        id: node.id,
      });
      await expect(nodes.getById(workspaceB.id, corpus.id, node.id)).resolves.toBeNull();
      await expect(nodes.listByCorpus(workspaceB.id, corpus.id)).resolves.toEqual([]);

      const updated = await nodes.updateContent(workspaceB.id, corpus.id, node.id, {
        contentHash: 'abc',
        sizeBytes: 3,
        storageRelPath: 'managed/test',
      });
      expect(updated).toBeNull();
    } finally {
      await handle.close();
    }
  });

  it('scopes chunk and link reads to workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const chunks = new ChunkRepository(handle);
      const links = new LinkRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const corpus = await corpora.create({
        workspaceId: workspaceA.id,
        name: 'Primary Corpus',
      });

      const node = await nodes.create({
        workspaceId: workspaceA.id,
        corpusId: corpus.id,
        path: '',
        name: 'notes.md',
        nodeType: 'file',
      });

      await chunks.replaceForNode(workspaceA.id, corpus.id, node.id, [
        {
          workspaceId: workspaceA.id,
          corpusId: corpus.id,
          nodeId: node.id,
          ordinal: 0,
          filePath: 'notes.md',
          folderPath: '',
          headingPath: [],
          body: 'hello world',
          bodyPreview: 'hello world',
          tokenCount: 2,
        },
      ]);

      await links.replaceForNode(workspaceA.id, corpus.id, node.id, [
        {
          workspaceId: workspaceA.id,
          corpusId: corpus.id,
          fromNodeId: node.id,
          linkKind: 'wikilink',
          raw: '[[Other]]',
          targetPath: 'Other',
        },
      ]);

      await expect(chunks.listByCorpus(workspaceB.id, corpus.id)).resolves.toEqual([]);
      await expect(links.listByCorpus(workspaceB.id, corpus.id)).resolves.toEqual([]);
      await expect(chunks.searchKeyword(workspaceB.id, corpus.id, 'hello')).resolves.toEqual([]);
    } finally {
      await handle.close();
    }
  });

  it('applies KnowledgeFilters in searchKeyword SQL JOIN path', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const chunks = new ChunkRepository(handle);

      const workspace = await workspaces.create({
        slug: `ws-filter-${randomUUID()}`,
        name: 'Filter Workspace',
      });
      const corpus = await corpora.create({
        workspaceId: workspace.id,
        name: 'Filter Corpus',
      });

      const managedNode = await nodes.create({
        workspaceId: workspace.id,
        corpusId: corpus.id,
        path: '',
        name: 'ops-runbook.md',
        nodeType: 'file',
        sourceType: 'managed',
      });
      const gitNode = await nodes.create({
        workspaceId: workspace.id,
        corpusId: corpus.id,
        path: '',
        name: 'ops-guide.md',
        nodeType: 'file',
        sourceType: 'git',
      });

      await nodes.updateIndexStatus(workspace.id, corpus.id, managedNode.id, {
        indexStatus: 'indexed',
        metadata: { frontmatter: { tags: ['ops'] } },
      });
      await nodes.updateIndexStatus(workspace.id, corpus.id, gitNode.id, {
        indexStatus: 'indexed',
        metadata: { frontmatter: { tags: ['docs'] } },
      });

      await chunks.replaceForNode(workspace.id, corpus.id, managedNode.id, [
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          nodeId: managedNode.id,
          ordinal: 0,
          filePath: 'ops-runbook.md',
          folderPath: '',
          headingPath: [],
          body: 'operations runbook for on-call',
          bodyPreview: 'operations runbook for on-call',
          tokenCount: 5,
        },
      ]);
      await chunks.replaceForNode(workspace.id, corpus.id, gitNode.id, [
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          nodeId: gitNode.id,
          ordinal: 0,
          filePath: 'ops-guide.md',
          folderPath: '',
          headingPath: [],
          body: 'operations documentation guide',
          bodyPreview: 'operations documentation guide',
          tokenCount: 4,
        },
      ]);

      const unfiltered = await chunks.searchKeyword(workspace.id, corpus.id, 'operations');
      expect(unfiltered.map((hit) => hit.nodeId).sort()).toEqual(
        [managedNode.id, gitNode.id].sort(),
      );

      const tagFiltered = await chunks.searchKeyword(workspace.id, corpus.id, 'operations', {
        filters: { tags: ['ops'] },
      });
      expect(tagFiltered).toHaveLength(1);
      expect(tagFiltered[0]?.nodeId).toBe(managedNode.id);

      const sourceFiltered = await chunks.searchKeyword(workspace.id, corpus.id, 'operations', {
        filters: { sourceTypes: ['managed'] },
      });
      expect(sourceFiltered).toHaveLength(1);
      expect(sourceFiltered[0]?.nodeId).toBe(managedNode.id);

      const negativeTag = await chunks.searchKeyword(workspace.id, corpus.id, 'operations', {
        filters: { tags: ['missing'] },
      });
      expect(negativeTag).toEqual([]);
    } finally {
      await handle.close();
    }
  });
});
