import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import { databaseUrl, describeIfDb, requireDatabaseUrl } from './helpers.js';

describeIfDb('kb-server corpus and file routes', () => {
  it('creates corpora and manages managed files with workspace isolation', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-api-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
      });

      const workspaceResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora`,
        payload: { name: 'ignored' },
      });
      expect(workspaceResponse.statusCode).toBe(404);

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Integration Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs', description: 'Primary docs' },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();
      expect(corpus.name).toBe('Docs');

      const listCorpora = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
      });
      expect(listCorpora.statusCode).toBe(200);
      expect(listCorpora.json()).toHaveLength(1);

      const folder = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/folders`,
        payload: { path: '', name: 'guides' },
      });
      expect(folder.statusCode).toBe(201);

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'intro.md',
          content: '# Intro\n',
        },
      });
      expect(upload.statusCode).toBe(201);
      const file = upload.json();

      const read = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
      });
      expect(read.statusCode).toBe(200);
      expect(read.body).toBe('# Intro\n');

      const save = await server.inject({
        method: 'PUT',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
        headers: {
          'content-type': 'text/plain',
        },
        payload: '# Intro Updated\n',
      });
      expect(save.statusCode).toBe(200);
      expect(save.json().indexStatus).toBe('pending');

      const wrongWorkspace = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/nodes/${file.id}/content`,
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      const auditResponse = await server.inject({
        method: 'GET',
        url: `/api/workspaces/${workspace.id}/audit`,
      });
      expect(auditResponse.statusCode).toBe(200);
      const auditEntries = auditResponse.json() as Array<{
        action: string;
        actor: Record<string, unknown>;
        target: Record<string, unknown> | null;
      }>;
      const folderAudit = auditEntries.find((entry) => entry.action === 'create_folder');
      expect(folderAudit).toMatchObject({
        actor: { kind: 'dev' },
        target: { corpusId: corpus.id, path: 'guides' },
      });
      const createAudit = auditEntries.find((entry) => entry.action === 'create_file');
      expect(createAudit).toMatchObject({
        actor: { kind: 'dev' },
        target: { corpusId: corpus.id, nodeId: file.id, path: 'intro.md' },
      });
      const saveAudit = auditEntries.find((entry) => entry.action === 'save_file');
      expect(saveAudit).toMatchObject({
        actor: { kind: 'dev' },
        target: { corpusId: corpus.id, nodeId: file.id, path: 'intro.md' },
      });

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('rejects unsafe upload paths', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-api-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
      });

      const { createDb, migrateLatest, WorkspaceRepository, CorpusRepository } = await import(
        '@evu/kb-db'
      );
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Traversal Workspace' });
      const corpus = await corpora.create({
        workspaceId: workspace.id,
        name: 'Docs',
      });
      await handle.close();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '../secrets',
          name: 'evil.md',
          content: 'nope',
        },
      });
      expect(upload.statusCode).toBe(400);
      expect(upload.json().code).toBe('validation_error');

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
