import { parseCorpusSyncSettings, resolveImportKind } from '../sync/settings.js';

export function resolveSyncIntervalMinutes(settings: Record<string, unknown>): number | null {
  const interval = settings.syncIntervalMinutes;
  if (typeof interval !== 'number' || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }
  return Math.floor(interval);
}

export function isSyncDue(settings: Record<string, unknown>, nowMs: number = Date.now()): boolean {
  const interval = resolveSyncIntervalMinutes(settings);
  if (!interval) {
    return false;
  }

  const importKind = resolveImportKind(settings);
  if (importKind !== 'mount' && importKind !== 'git') {
    return false;
  }

  const syncSettings = parseCorpusSyncSettings(settings);
  if (syncSettings.syncStatus?.lastSyncStatus === 'running') {
    return false;
  }

  const lastSyncAt = syncSettings.syncStatus?.lastSyncAt;
  if (!lastSyncAt) {
    return true;
  }

  const lastMs = Date.parse(lastSyncAt);
  if (Number.isNaN(lastMs)) {
    return true;
  }

  return lastMs + interval * 60_000 <= nowMs;
}
