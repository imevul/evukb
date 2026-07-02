import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import { databaseUrl, describeIfDb, waitForNodeIndexedViaJobs } from './helpers.js';

describeIfDb('kb-server portable export and import', () => {
  it('round-trips a corpus through portable export and import', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-portable-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
        chatProvider: null,
      });

      const createCorpus = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        payload: { name: `Portable corpus ${randomUUID()}` },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const file = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'note.md',
          content: '# Portable\n\nRound trip content.\n',
        },
      });
      expect(file.statusCode).toBe(201);
      const nodeId = file.json().id as string;
      await waitForNodeIndexedViaJobs(server, 'local-dev', corpus.id, nodeId);

      const exportZip = await server.inject({
        method: 'GET',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/export`,
      });
      expect(exportZip.statusCode).toBe(200);
      expect(exportZip.headers['content-type']).toContain('application/zip');

      const boundary = '----evukbtest';
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(
          'Content-Disposition: form-data; name="archive"; filename="portable.evukb.zip"\r\n',
        ),
        Buffer.from('Content-Type: application/zip\r\n\r\n'),
        exportZip.rawPayload,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const importResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/import`,
        payload: multipartBody,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
      });
      expect(importResponse.statusCode).toBe(200);
      const body = importResponse.json();
      expect(body.mode).toBe('portable');
      expect(body.skipped + body.updated).toBeGreaterThan(0);
      expect(body.errors).toEqual([]);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('rejects portable zip entries with path traversal', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-portable-bad-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
      });

      const createCorpus = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        payload: { name: `Portable bad zip corpus ${randomUUID()}` },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const { zipSync } = await import('fflate');
      const badZip = Buffer.from(
        zipSync({
          'files/../escape.txt': new TextEncoder().encode('nope'),
          '.evukb/manifest.json': new TextEncoder().encode('{}'),
        }),
      );

      const boundary = '----evukbbad';
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="archive"; filename="bad.zip"\r\n'),
        Buffer.from('Content-Type: application/zip\r\n\r\n'),
        badZip,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const importResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/import`,
        payload: multipartBody,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
      });
      expect(importResponse.statusCode).toBe(400);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('imports a generic zip archive into a corpus tree', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-archive-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
      });

      const createCorpus = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        payload: { name: `Archive corpus ${randomUUID()}` },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const { zipSync } = await import('fflate');
      const archiveZip = Buffer.from(
        zipSync({
          'vault/notes/a.md': new TextEncoder().encode('# A'),
          'vault/notes/b.md': new TextEncoder().encode('# B'),
        }),
      );

      const boundary = '----evukbarchive';
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="archive"; filename="vault.zip"\r\n'),
        Buffer.from('Content-Type: application/zip\r\n\r\n'),
        archiveZip,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const importResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/import`,
        payload: multipartBody,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
      });
      expect(importResponse.statusCode).toBe(200);
      const body = importResponse.json();
      expect(body.mode).toBe('archive');
      expect(body.imported).toBe(2);
      expect(body.errors).toEqual([]);

      const nodes = await server.inject({
        method: 'GET',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/nodes?format=flat`,
      });
      expect(nodes.statusCode).toBe(200);
      const paths = (nodes.json() as Array<{ nodeType: string; path: string; name: string }>)
        .filter((node) => node.nodeType === 'file')
        .map((node) => (node.path ? `${node.path}/${node.name}` : node.name))
        .sort();
      expect(paths).toEqual(['notes/a.md', 'notes/b.md']);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
