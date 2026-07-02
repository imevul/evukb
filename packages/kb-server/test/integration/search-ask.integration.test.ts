import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  createRerankChatProvider,
  createStubChatProvider,
  databaseUrl,
  describeIfDb,
  requireDatabaseUrl,
  waitForBackgroundJobs,
  waitForNodeIndexed,
  waitForNodeIndexedViaJobs,
} from './helpers.js';

describeIfDb('kb-server search routes', () => {
  it('indexes markdown and returns hybrid search hits', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-search-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Search Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'search-target.md',
          content: '# Search Target\n\nEvuKB hybrid search fixture keyword alpha.\n',
        },
      });
      const file = upload.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const reindex = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex`,
        payload: { nodeIds: [file.id] },
      });
      expect(reindex.statusCode).toBe(200);
      expect(reindex.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const search = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'alpha fixture' },
      });
      expect(search.statusCode).toBe(200);
      expect(search.json().length).toBeGreaterThan(0);
      expect(search.json()[0]?.bodyPreview).toContain('alpha');

      const wrongWorkspace = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'alpha' },
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server ask routes', () => {
  it('asks over indexed corpus content with citations and workspace isolation', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-ask-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createStubChatProvider(),
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Ask Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const upload = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'ask-target.md',
          content: '# Ask Target\n\nEvuKB ask alpha fixture keyword.\n',
        },
      });
      const file = upload.json();
      expect(upload.statusCode).toBe(201);
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, file.id);

      const reindex = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/reindex`,
        payload: { nodeIds: [file.id] },
      });
      expect(reindex.statusCode).toBe(200);
      expect(reindex.json().enqueued).toBe(1);
      await waitForBackgroundJobs(server);
      await waitForNodeIndexed(server, workspace.id, corpus.id, file.id);

      const ask = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'What is the alpha fixture?' },
      });
      expect(ask.statusCode).toBe(200);
      const body = ask.json();
      expect(body.answer).toContain('alpha fixture');
      expect(body.citations.length).toBeGreaterThan(0);
      expect(body.usedChunks.length).toBeGreaterThan(0);
      expect(body.retrievalTrace).toMatchObject({
        query: 'What is the alpha fixture?',
        selectedCount: body.usedChunks.length,
      });
      expect(body.model).toBe('integration-mock');

      const streamResponse = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'What is the alpha fixture?', stream: true },
      });
      expect(streamResponse.statusCode).toBe(200);
      expect(streamResponse.headers['content-type']).toContain('text/event-stream');
      expect(streamResponse.payload).toContain('"type":"metadata"');
      expect(streamResponse.payload).toContain('"type":"token"');
      expect(streamResponse.payload).toContain('alpha fixture');

      const wrongWorkspace = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${randomUUID()}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'alpha fixture' },
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('returns 503 when chat provider is not configured', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-ask-unconfigured-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: null,
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Ask Unconfigured Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Docs' },
      });
      const corpus = createCorpus.json();

      const ask = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'Hello?' },
      });
      expect(ask.statusCode).toBe(503);
      expect(ask.json()).toMatchObject({ code: 'service_unavailable' });

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server workspace ask', () => {
  it('merges retrieval across multiple corpora and validates corpusIds', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-workspace-ask-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createStubChatProvider(),
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Workspace Ask' });
      await handle.close();

      const createCorpusA = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Corpus A' },
      });
      const corpusA = createCorpusA.json();

      const createCorpusB = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Corpus B' },
      });
      const corpusB = createCorpusB.json();

      const uploadA = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpusA.id}/files`,
        payload: {
          path: '',
          name: 'a.md',
          content: '# Corpus A\n\nUnique alpha workspace ask keyword.\n',
        },
      });
      const fileA = uploadA.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpusA.id, fileA.id);

      const uploadB = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpusB.id}/files`,
        payload: {
          path: '',
          name: 'b.md',
          content: '# Corpus B\n\nUnique beta workspace ask keyword.\n',
        },
      });
      const fileB = uploadB.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpusB.id, fileB.id);

      const emptyCorpora = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/ask`,
        payload: { question: 'test', corpusIds: [] },
      });
      expect(emptyCorpora.statusCode).toBe(400);

      const missingCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/ask`,
        payload: { question: 'test', corpusIds: [randomUUID()] },
      });
      expect(missingCorpus.statusCode).toBe(404);

      const askBoth = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/ask`,
        payload: {
          question: 'alpha',
          corpusIds: [corpusA.id, corpusB.id],
        },
      });
      expect(askBoth.statusCode).toBe(200);
      const body = askBoth.json();
      expect(body.answer).toBeTruthy();
      expect(body.citations.length).toBeGreaterThan(0);
      const corpusIdsInCitations = new Set(
        body.citations.map((c: { corpusId: string }) => c.corpusId),
      );
      expect(corpusIdsInCitations.size).toBeGreaterThanOrEqual(1);
      expect(body.retrievalTrace.corpusCount).toBe(2);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server workspace search', () => {
  it('merges search results across multiple corpora and validates corpusIds', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-workspace-search-'));
    const slug = `it-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: null,
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Workspace Search' });
      await handle.close();

      const createCorpusA = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Search Corpus A' },
      });
      const corpusA = createCorpusA.json();

      const createCorpusB = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Search Corpus B' },
      });
      const corpusB = createCorpusB.json();

      const uploadA = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpusA.id}/files`,
        payload: {
          path: '',
          name: 'a.md',
          content: '# Corpus A\n\nUnique alpha workspace search keyword.\n',
        },
      });
      const fileA = uploadA.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpusA.id, fileA.id);

      const uploadB = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpusB.id}/files`,
        payload: {
          path: '',
          name: 'b.md',
          content: '# Corpus B\n\nUnique beta workspace search keyword.\n',
        },
      });
      const fileB = uploadB.json();
      await waitForNodeIndexedViaJobs(server, workspace.id, corpusB.id, fileB.id);

      const emptyCorpora = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/search`,
        payload: { query: 'keyword', corpusIds: [] },
      });
      expect(emptyCorpora.statusCode).toBe(400);

      const missingCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/search`,
        payload: { query: 'keyword', corpusIds: [randomUUID()] },
      });
      expect(missingCorpus.statusCode).toBe(404);

      const searchBoth = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/search`,
        payload: {
          query: 'workspace search keyword',
          corpusIds: [corpusA.id, corpusB.id],
        },
      });
      expect(searchBoth.statusCode).toBe(200);
      const hits = searchBoth.json() as Array<{ corpusId: string; bodyPreview: string }>;
      expect(hits.length).toBeGreaterThan(0);
      const corpusIdsInHits = new Set(hits.map((hit) => hit.corpusId));
      expect(corpusIdsInHits.size).toBeGreaterThanOrEqual(1);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server ranking settings in search', () => {
  it('applies workspace ranking weights to search traces', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-ranking-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
        chatProvider: null,
      });

      await server.inject({
        method: 'PATCH',
        url: '/api/workspaces/local-dev/settings',
        payload: {
          settings: {
            rankingSettings: {
              keywordWeight: 0.75,
              semanticWeight: 1.25,
              recencyBoost: 0.5,
              exactTitleBoost: 0.75,
            },
          },
        },
      });

      const createCorpus = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        payload: { name: `Ranking corpus ${randomUUID()}` },
      });
      expect(createCorpus.statusCode).toBe(201);
      const corpus = createCorpus.json();

      const folder = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/folders`,
        payload: { path: '', name: 'docs' },
      });
      expect(folder.statusCode).toBe(201);

      const file = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'alpha.md',
          content:
            '---\ntitle: Alpha Guide\n---\n# Alpha Guide\n\nAlpha Guide alpha fixture keyword.\n',
        },
      });
      expect(file.statusCode).toBe(201);
      const nodeId = file.json().id as string;

      await waitForNodeIndexedViaJobs(server, 'local-dev', corpus.id, nodeId);

      const search = await server.inject({
        method: 'POST',
        url: `/api/workspaces/local-dev/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'Alpha Guide' },
      });
      expect(search.statusCode).toBe(200);
      const first = search.json()[0];
      expect(first.ranking.componentScores.keywordWeight).toBe(0.75);
      expect(first.ranking.componentScores.semanticWeight).toBe(1.25);
      expect(first.ranking.componentScores.recencyBoost).toBeGreaterThan(1);
      expect(first.ranking.componentScores.exactTitleBoost).toBe(1.75);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server reranker_llm search', () => {
  it('applies LLM rerank order to search results when chat provider is configured', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-rerank-'));
    const slug = `rerank-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createRerankChatProvider(),
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Rerank Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Rerank corpus' },
      });
      const corpus = createCorpus.json();

      const firstFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'first-rerank.md',
          content: '# First\n\nrerank fixture alpha one.\n',
        },
      });
      const secondFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'second-rerank.md',
          content: '# Second\n\nrerank fixture beta two.\n',
        },
      });
      expect(firstFile.statusCode).toBe(201);
      expect(secondFile.statusCode).toBe(201);

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, firstFile.json().id);
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, secondFile.json().id);

      const hybridSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'rerank fixture' },
      });
      expect(hybridSearch.statusCode).toBe(200);
      expect(hybridSearch.json().length).toBeGreaterThanOrEqual(2);
      const hybridOrder = hybridSearch.json().map((hit: { filePath: string }) => hit.filePath);

      const rerankSearch = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/search`,
        payload: { query: 'rerank fixture', rankingStrategyId: 'reranker_llm' },
      });
      expect(rerankSearch.statusCode).toBe(200);
      expect(rerankSearch.json().length).toBeGreaterThanOrEqual(2);
      expect(rerankSearch.json()[0]?.ranking.strategyId).toBe('reranker_llm');
      expect(rerankSearch.json()[0]?.ranking.componentScores.llmRerank).toBe(1);

      const rerankOrder = rerankSearch.json().map((hit: { filePath: string }) => hit.filePath);
      expect(rerankOrder).toEqual([...hybridOrder].reverse());

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server reranker_llm ask', () => {
  it('applies LLM rerank order to ask retrieval when chat provider is configured', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-ask-rerank-'));
    const slug = `ask-rerank-${randomUUID()}`;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: false,
        chatProvider: createRerankChatProvider(),
      });

      const { createDb, migrateLatest, WorkspaceRepository } = await import('@evu/kb-db');
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.create({ slug, name: 'Ask Rerank Workspace' });
      await handle.close();

      const createCorpus = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora`,
        payload: { name: 'Ask rerank corpus' },
      });
      const corpus = createCorpus.json();

      const firstFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'first-ask-rerank.md',
          content: '# First\n\nrerank fixture alpha one.\n',
        },
      });
      const secondFile = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/files`,
        payload: {
          path: '',
          name: 'second-ask-rerank.md',
          content: '# Second\n\nrerank fixture beta two.\n',
        },
      });

      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, firstFile.json().id);
      await waitForNodeIndexedViaJobs(server, workspace.id, corpus.id, secondFile.json().id);

      const hybridAsk = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'rerank fixture' },
      });
      expect(hybridAsk.statusCode).toBe(200);
      const hybridOrder = hybridAsk
        .json()
        .usedChunks.map((hit: { filePath: string }) => hit.filePath);

      const rerankAsk = await server.inject({
        method: 'POST',
        url: `/api/workspaces/${workspace.id}/knowledge-corpora/${corpus.id}/ask`,
        payload: { question: 'rerank fixture', rankingStrategyId: 'reranker_llm' },
      });
      expect(rerankAsk.statusCode).toBe(200);
      const body = rerankAsk.json();
      expect(body.retrievalTrace.strategyId).toBe('reranker_llm');
      expect(body.usedChunks.length).toBeGreaterThanOrEqual(2);
      expect(body.usedChunks[0]?.ranking.componentScores.llmRerank).toBeGreaterThan(0);

      const rerankOrder = body.usedChunks.map((hit: { filePath: string }) => hit.filePath);
      expect(rerankOrder).toEqual(expect.arrayContaining(hybridOrder));
      expect(rerankOrder).toHaveLength(hybridOrder.length);

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
