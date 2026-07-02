import type { DbHandle } from './client.js';
import { WorkspaceRepository } from './repositories/workspace-repository.js';

export const devWorkspaceSlug = 'local-dev';

export async function ensureDevWorkspace(handle: DbHandle): Promise<{ id: string; slug: string }> {
  const workspaces = new WorkspaceRepository(handle);
  const existing = await workspaces.getBySlug(devWorkspaceSlug);
  if (existing) {
    return { id: existing.id, slug: existing.slug };
  }

  try {
    const created = await workspaces.create({
      slug: devWorkspaceSlug,
      name: 'Local Development',
    });
    return { id: created.id, slug: created.slug };
  } catch (error) {
    const retry = await workspaces.getBySlug(devWorkspaceSlug);
    if (retry) {
      return { id: retry.id, slug: retry.slug };
    }
    throw error;
  }
}
