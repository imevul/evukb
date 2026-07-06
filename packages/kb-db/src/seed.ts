import type { DbHandle } from './client.js';
import { WorkspaceRepository } from './repositories/workspace-repository.js';

export const devWorkspaceSlug = 'local-dev';

export type EnsureWorkspaceInput = {
  slug: string;
  name: string;
};

export async function ensureWorkspace(
  handle: DbHandle,
  input: EnsureWorkspaceInput,
): Promise<{ id: string; slug: string }> {
  const workspaces = new WorkspaceRepository(handle);
  const existing = await workspaces.getBySlug(input.slug);
  if (existing) {
    return { id: existing.id, slug: existing.slug };
  }

  try {
    const created = await workspaces.create({
      slug: input.slug,
      name: input.name,
    });
    return { id: created.id, slug: created.slug };
  } catch (error) {
    const retry = await workspaces.getBySlug(input.slug);
    if (retry) {
      return { id: retry.id, slug: retry.slug };
    }
    throw error;
  }
}

export async function ensureDevWorkspace(handle: DbHandle): Promise<{ id: string; slug: string }> {
  return ensureWorkspace(handle, {
    slug: devWorkspaceSlug,
    name: 'Local Development',
  });
}
