import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuditLogRepository,
  createDb,
  migrateLatest,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb('AuditLogRepository', () => {
  it('lists entries scoped to workspace with limit cap and action filter', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const auditLog = new AuditLogRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      await auditLog.record({
        workspaceId: workspaceA.id,
        action: 'create_document',
        actor: { kind: 'mcp_token', tokenId: 'token-a' },
        target: { corpusId: randomUUID(), path: 'notes/a.md' },
      });
      await auditLog.record({
        workspaceId: workspaceA.id,
        action: 'append_document',
        actor: { kind: 'api_key', tokenId: 'key-a' },
        target: { corpusId: randomUUID(), path: 'notes/a.md' },
      });
      await auditLog.record({
        workspaceId: workspaceA.id,
        action: 'create_document',
        actor: { kind: 'dev' },
        target: { corpusId: randomUUID(), path: 'notes/b.md' },
      });
      await auditLog.record({
        workspaceId: workspaceB.id,
        action: 'create_document',
        actor: { kind: 'dev' },
        target: { corpusId: randomUUID(), path: 'other/c.md' },
      });

      const workspaceEntries = await auditLog.listByWorkspace(workspaceA.id);
      expect(workspaceEntries).toHaveLength(3);
      expect(workspaceEntries.every((entry) => entry.workspaceId === workspaceA.id)).toBe(true);
      expect(workspaceEntries[0]?.createdAt >= workspaceEntries[1]?.createdAt).toBe(true);

      await expect(auditLog.listByWorkspace(workspaceB.id)).resolves.toHaveLength(1);
      await expect(auditLog.listByWorkspace(workspaceA.id, { limit: 1 })).resolves.toHaveLength(1);
      await expect(auditLog.listByWorkspace(workspaceA.id, { limit: 999 })).resolves.toHaveLength(
        3,
      );
      await expect(
        auditLog.listByWorkspace(workspaceA.id, { action: 'append_document' }),
      ).resolves.toMatchObject([{ action: 'append_document' }]);
      await expect(
        auditLog.listByWorkspace(workspaceA.id, { action: 'missing_action' }),
      ).resolves.toEqual([]);
    } finally {
      await handle.close();
    }
  });
});
