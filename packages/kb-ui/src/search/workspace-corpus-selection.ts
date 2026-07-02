const STORAGE_KEY_PREFIX = 'evukb-workspace-corpus-ids:';

function corpusSelectionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function storageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

export function readStoredWorkspaceCorpusIds(workspaceId: string): string[] | null {
  const raw = corpusSelectionStorage()?.getItem(storageKey(workspaceId));
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredWorkspaceCorpusIds(workspaceId: string, corpusIds: string[]): void {
  corpusSelectionStorage()?.setItem(storageKey(workspaceId), JSON.stringify(corpusIds));
}

export function removeStoredWorkspaceCorpusId(workspaceId: string, corpusId: string): void {
  const stored = readStoredWorkspaceCorpusIds(workspaceId);
  if (!stored) {
    return;
  }
  writeStoredWorkspaceCorpusIds(
    workspaceId,
    stored.filter((id) => id !== corpusId),
  );
}

export function resolveWorkspaceCorpusSelection(
  availableCorpusIds: string[],
  storedCorpusIds: string[] | null,
): string[] {
  const available = new Set(availableCorpusIds);
  if (storedCorpusIds && storedCorpusIds.length > 0) {
    const valid = storedCorpusIds.filter((id) => available.has(id));
    if (valid.length > 0) {
      return valid;
    }
  }

  const first = availableCorpusIds[0];
  return first ? [first] : [];
}
