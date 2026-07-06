const SELECTED_WORKSPACE_KEY = 'evukb_selected_workspace';

export function readSelectedWorkspaceSlug(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(SELECTED_WORKSPACE_KEY)?.trim();
  return value || null;
}

export function writeSelectedWorkspaceSlug(slug: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SELECTED_WORKSPACE_KEY, slug);
}

export function clearSelectedWorkspaceSlug(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
}
