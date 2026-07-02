import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
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

describeIfDb('link repository resolution', () => {
  it('patches incoming targets within workspace boundaries', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
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
        name: 'Docs',
      });

      const source = await nodes.create({
        workspaceId: workspaceA.id,
        corpusId: corpus.id,
        path: '',
        name: 'source.md',
        nodeType: 'file',
      });
      const target = await nodes.create({
        workspaceId: workspaceA.id,
        corpusId: corpus.id,
        path: '',
        name: 'target.md',
        nodeType: 'file',
      });

      await links.replaceForNode(workspaceA.id, corpus.id, source.id, [
        {
          workspaceId: workspaceA.id,
          corpusId: corpus.id,
          fromNodeId: source.id,
          linkKind: 'wikilink',
          raw: '[[target]]',
          targetPath: 'target',
          resolved: false,
        },
      ]);

      const updated = await links.resolveIncomingTargets(
        workspaceA.id,
        corpus.id,
        ['target', 'target.md'],
        target.id,
      );
      expect(updated).toBe(1);

      const workspaceLinks = await links.listByCorpus(workspaceA.id, corpus.id);
      expect(workspaceLinks[0]?.toNodeId).toBe(target.id);
      expect(workspaceLinks[0]?.resolved).toBe(true);

      const otherWorkspaceCount = await links.resolveIncomingTargets(
        workspaceB.id,
        corpus.id,
        ['target'],
        randomUUID(),
      );
      expect(otherWorkspaceCount).toBe(0);
    } finally {
      await handle.close();
    }
  });

  it('counts resolved and unresolved internal links', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const links = new LinkRepository(handle);

      const workspace = await workspaces.create({
        slug: `ws-${randomUUID()}`,
        name: 'Stats Workspace',
      });
      const corpus = await corpora.create({
        workspaceId: workspace.id,
        name: 'Docs',
      });
      const source = await nodes.create({
        workspaceId: workspace.id,
        corpusId: corpus.id,
        path: '',
        name: 'source.md',
        nodeType: 'file',
      });
      const target = await nodes.create({
        workspaceId: workspace.id,
        corpusId: corpus.id,
        path: '',
        name: 'target.md',
        nodeType: 'file',
      });

      await links.replaceForNode(workspace.id, corpus.id, source.id, [
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          fromNodeId: source.id,
          linkKind: 'wikilink',
          raw: '[[target]]',
          targetPath: 'target',
          toNodeId: target.id,
          resolved: true,
        },
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          fromNodeId: source.id,
          linkKind: 'wikilink',
          raw: '[[missing]]',
          targetPath: 'missing',
          resolved: false,
        },
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          fromNodeId: source.id,
          linkKind: 'markdown',
          raw: '[Example](https://example.com)',
          externalUrl: 'https://example.com',
          resolved: false,
        },
      ]);

      await expect(links.countByResolution(workspace.id, corpus.id)).resolves.toEqual({
        total: 3,
        internal: 2,
        resolved: 1,
        unresolved: 1,
      });
    } finally {
      await handle.close();
    }
  });
});
