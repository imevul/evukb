import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createDb,
  migrateLatest,
  resolveDatabaseUrl,
  SecretRepository,
  WorkspaceRepository,
} from '../src/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb('SecretRepository', () => {
  it('scopes secrets by workspace and never exposes ciphertext in metadata', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const secretsRepo = new SecretRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const name = `openai-key-${randomUUID()}`;
      const created = await secretsRepo.create({
        workspaceId: workspaceA.id,
        name,
        ciphertext: Buffer.from('cipher-a'),
        nonce: Buffer.from('nonce-a-1234'),
      });
      expect(created).not.toHaveProperty('ciphertext');
      expect(created).not.toHaveProperty('nonce');

      // Lookup by name is workspace scoped.
      const stored = await secretsRepo.getByName(workspaceA.id, name);
      expect(stored?.ciphertext.toString()).toBe('cipher-a');
      await expect(secretsRepo.getByName(workspaceB.id, name)).resolves.toBeNull();

      // Listing only returns metadata for the owning workspace.
      const listA = await secretsRepo.listByWorkspace(workspaceA.id);
      expect(listA.some((secret) => secret.id === created.id)).toBe(true);
      expect(listA.every((secret) => !('ciphertext' in secret))).toBe(true);
      const listB = await secretsRepo.listByWorkspace(workspaceB.id);
      expect(listB.some((secret) => secret.id === created.id)).toBe(false);
    } finally {
      await handle.close();
    }
  });

  it('rotates and deletes secrets only within the owning workspace', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const secretsRepo = new SecretRepository(handle);

      const workspaceA = await workspaces.create({
        slug: `ws-a-${randomUUID()}`,
        name: 'Workspace A',
      });
      const workspaceB = await workspaces.create({
        slug: `ws-b-${randomUUID()}`,
        name: 'Workspace B',
      });

      const name = `rotate-me-${randomUUID()}`;
      const created = await secretsRepo.create({
        workspaceId: workspaceA.id,
        name,
        ciphertext: Buffer.from('cipher-v1'),
        nonce: Buffer.from('nonce-v1-1234'),
      });

      // Cross-workspace rotation must not touch the secret.
      await expect(
        secretsRepo.update(workspaceB.id, created.id, {
          ciphertext: Buffer.from('evil'),
          nonce: Buffer.from('evil-nonce-1'),
        }),
      ).resolves.toBeNull();

      const rotated = await secretsRepo.update(workspaceA.id, created.id, {
        ciphertext: Buffer.from('cipher-v2'),
        nonce: Buffer.from('nonce-v2-1234'),
      });
      expect(rotated?.id).toBe(created.id);
      const afterRotate = await secretsRepo.getByName(workspaceA.id, name);
      expect(afterRotate?.ciphertext.toString()).toBe('cipher-v2');

      // Cross-workspace delete is a no-op; in-workspace delete removes it.
      await expect(secretsRepo.delete(workspaceB.id, created.id)).resolves.toBe(false);
      await expect(secretsRepo.delete(workspaceA.id, created.id)).resolves.toBe(true);
      await expect(secretsRepo.getByName(workspaceA.id, name)).resolves.toBeNull();
    } finally {
      await handle.close();
    }
  });
});
