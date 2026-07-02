import { randomUUID } from 'node:crypto';
import type { KbWriteToolRequest } from '@evu/kb-core';
import { describe, expect, it } from 'vitest';
import {
  CorpusRepository,
  createDb,
  MutationApprovalRepository,
  migrateLatest,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

function appendRequest(corpusId: string): KbWriteToolRequest {
  return {
    action: 'append_document',
    corpusId,
    path: 'notes/pending.md',
    body: 'appended line',
  };
}

describeIfDb('MutationApprovalRepository', () => {
  it('creates pending approvals and lists them scoped to workspace', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const approvals = new MutationApprovalRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });
      const corpusA = await corpora.create({ workspaceId: workspaceA.id, name: 'Corpus A' });
      const corpusB = await corpora.create({ workspaceId: workspaceB.id, name: 'Corpus B' });

      const pendingA = await approvals.createPending({
        workspaceId: workspaceA.id,
        corpusId: corpusA.id,
        action: 'append_document',
        request: appendRequest(corpusA.id),
        actor: { kind: 'mcp_token', tokenId: 'token-a' },
        preview: { corpusId: corpusA.id, action: 'append_document', path: 'notes/pending.md' },
      });
      await approvals.createPending({
        workspaceId: workspaceB.id,
        corpusId: corpusB.id,
        action: 'append_document',
        request: appendRequest(corpusB.id),
        actor: { kind: 'dev' },
        preview: { corpusId: corpusB.id, action: 'append_document', path: 'notes/pending.md' },
      });

      expect(pendingA.status).toBe('pending');
      expect(pendingA.decidedBy).toBeNull();
      expect(pendingA.decidedAt).toBeNull();

      const listA = await approvals.listPending(workspaceA.id);
      expect(listA.some((record) => record.id === pendingA.id)).toBe(true);
      expect(listA.every((record) => record.workspaceId === workspaceA.id)).toBe(true);

      // Cross-workspace reads return nothing.
      await expect(approvals.getByIdInWorkspace(workspaceB.id, pendingA.id)).resolves.toBeNull();
      await expect(approvals.getByIdInWorkspace(workspaceA.id, pendingA.id)).resolves.toMatchObject(
        { id: pendingA.id, status: 'pending' },
      );

      // Limit is applied (and invalid limits fall back to the default).
      await expect(approvals.listPending(workspaceA.id, 1)).resolves.toHaveLength(1);
      const fallback = await approvals.listPending(workspaceA.id, -5);
      expect(fallback.length).toBeGreaterThan(0);
    } finally {
      await handle.close();
    }
  });

  it('applies and rejects pending approvals exactly once, scoped to workspace', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const approvals = new MutationApprovalRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });
      const corpusA = await corpora.create({ workspaceId: workspaceA.id, name: 'Corpus A' });

      const makePending = () =>
        approvals.createPending({
          workspaceId: workspaceA.id,
          corpusId: corpusA.id,
          action: 'append_document',
          request: appendRequest(corpusA.id),
          actor: { kind: 'api_key', tokenId: 'key-a' },
          preview: { corpusId: corpusA.id, action: 'append_document', path: 'notes/pending.md' },
        });

      // Cross-workspace decisions must be no-ops.
      const toApply = await makePending();
      await expect(
        approvals.markApplied(workspaceB.id, toApply.id, { kind: 'dev' }),
      ).resolves.toBeNull();

      const applied = await approvals.markApplied(workspaceA.id, toApply.id, { kind: 'dev' });
      expect(applied?.status).toBe('applied');
      expect(applied?.decidedBy).toEqual({ kind: 'dev' });
      expect(applied?.decidedAt).toBeTruthy();

      // A decided approval cannot be decided again.
      await expect(
        approvals.markApplied(workspaceA.id, toApply.id, { kind: 'dev' }),
      ).resolves.toBeNull();
      await expect(
        approvals.markRejected(workspaceA.id, toApply.id, { kind: 'dev' }),
      ).resolves.toBeNull();

      const toReject = await makePending();
      const rejected = await approvals.markRejected(workspaceA.id, toReject.id, {
        kind: 'mcp_token',
        tokenId: 'token-a',
      });
      expect(rejected?.status).toBe('rejected');

      // Decided approvals drop out of the pending list.
      const pending = await approvals.listPending(workspaceA.id);
      expect(pending.some((record) => record.id === toApply.id)).toBe(false);
      expect(pending.some((record) => record.id === toReject.id)).toBe(false);
    } finally {
      await handle.close();
    }
  });
});
