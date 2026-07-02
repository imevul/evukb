import type { ImportKind, MountSyncMode, SyncStatus } from './types.js';

export type CorpusSyncSettings = {
  importKind?: ImportKind;
  mountPath?: string;
  mountMode?: MountSyncMode;
  gitRemoteUrl?: string;
  gitRef?: string;
  gitCredentialSecretName?: string;
  syncIntervalMinutes?: number;
  syncStatus?: SyncStatus;
};

const IMPORT_KINDS: ImportKind[] = ['managed', 'mount', 'git'];
const MOUNT_MODES: MountSyncMode[] = ['import', 'mount_authoritative', 'import_writeback'];

function parseSyncStatus(value: unknown): SyncStatus | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const status: SyncStatus = {};
  if (typeof record.lastSyncAt === 'string') {
    status.lastSyncAt = record.lastSyncAt;
  }
  if (
    record.lastSyncStatus === 'idle' ||
    record.lastSyncStatus === 'running' ||
    record.lastSyncStatus === 'success' ||
    record.lastSyncStatus === 'failed'
  ) {
    status.lastSyncStatus = record.lastSyncStatus;
  }
  if (typeof record.lastSyncError === 'string') {
    status.lastSyncError = record.lastSyncError;
  }
  if (typeof record.lastCommitSha === 'string') {
    status.lastCommitSha = record.lastCommitSha;
  }
  return Object.keys(status).length > 0 ? status : undefined;
}

export function parseCorpusSyncSettings(settings: Record<string, unknown>): CorpusSyncSettings {
  const parsed: CorpusSyncSettings = {};

  const importKind = settings.importKind;
  if (importKind === 'managed' || importKind === 'mount' || importKind === 'git') {
    parsed.importKind = importKind;
  }

  if (typeof settings.mountPath === 'string' && settings.mountPath.trim()) {
    parsed.mountPath = settings.mountPath.trim();
  }

  if (
    settings.mountMode === 'import' ||
    settings.mountMode === 'mount_authoritative' ||
    settings.mountMode === 'import_writeback'
  ) {
    parsed.mountMode = settings.mountMode;
  }

  if (typeof settings.gitRemoteUrl === 'string' && settings.gitRemoteUrl.trim()) {
    parsed.gitRemoteUrl = settings.gitRemoteUrl.trim();
  }

  if (typeof settings.gitRef === 'string' && settings.gitRef.trim()) {
    parsed.gitRef = settings.gitRef.trim();
  }

  if (
    typeof settings.gitCredentialSecretName === 'string' &&
    settings.gitCredentialSecretName.trim()
  ) {
    parsed.gitCredentialSecretName = settings.gitCredentialSecretName.trim();
  }

  if (typeof settings.syncIntervalMinutes === 'number' && settings.syncIntervalMinutes > 0) {
    parsed.syncIntervalMinutes = Math.floor(settings.syncIntervalMinutes);
  }

  const syncStatus = parseSyncStatus(settings.syncStatus);
  if (syncStatus) {
    parsed.syncStatus = syncStatus;
  }

  return parsed;
}

export function resolveImportKind(settings: Record<string, unknown>): ImportKind {
  const importKind = settings.importKind;
  if (importKind === 'mount' || importKind === 'git') {
    return importKind;
  }
  return 'managed';
}

export function resolveGitRef(settings: Record<string, unknown>): string {
  const gitRef = settings.gitRef;
  if (typeof gitRef === 'string' && gitRef.trim()) {
    return gitRef.trim();
  }
  return 'main';
}

export function validateSyncSettings(
  settings: Record<string, unknown>,
  options: { allowMountAuthoritative?: boolean; allowImportWriteback?: boolean } = {},
): string | null {
  const importKind = settings.importKind;
  if (importKind !== undefined && !IMPORT_KINDS.includes(importKind as ImportKind)) {
    return 'settings.importKind must be "managed", "mount", or "git".';
  }

  if (settings.mountPath !== undefined && typeof settings.mountPath !== 'string') {
    return 'settings.mountPath must be a string.';
  }

  const mountMode = settings.mountMode;
  if (mountMode !== undefined && !MOUNT_MODES.includes(mountMode as MountSyncMode)) {
    return 'settings.mountMode must be "import", "mount_authoritative", or "import_writeback".';
  }
  if (mountMode === 'mount_authoritative' && !options.allowMountAuthoritative) {
    return 'settings.mountMode mount_authoritative requires EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true.';
  }
  if (mountMode === 'import_writeback' && !options.allowImportWriteback) {
    return 'settings.mountMode import_writeback requires EVUKB_ENABLE_IMPORT_WRITEBACK=true.';
  }

  if (settings.gitRemoteUrl !== undefined && typeof settings.gitRemoteUrl !== 'string') {
    return 'settings.gitRemoteUrl must be a string.';
  }

  if (settings.gitRef !== undefined && typeof settings.gitRef !== 'string') {
    return 'settings.gitRef must be a string.';
  }

  if (
    settings.gitCredentialSecretName !== undefined &&
    typeof settings.gitCredentialSecretName !== 'string'
  ) {
    return 'settings.gitCredentialSecretName must be a string.';
  }

  if (settings.syncIntervalMinutes !== undefined) {
    const interval = settings.syncIntervalMinutes;
    if (typeof interval !== 'number' || !Number.isFinite(interval) || interval < 0) {
      return 'settings.syncIntervalMinutes must be a non-negative number.';
    }
  }

  if (
    importKind === 'mount' &&
    typeof settings.mountPath === 'string' &&
    !settings.mountPath.trim()
  ) {
    return 'settings.mountPath is required when importKind is "mount".';
  }

  if (
    importKind === 'git' &&
    typeof settings.gitRemoteUrl === 'string' &&
    !settings.gitRemoteUrl.trim()
  ) {
    return 'settings.gitRemoteUrl is required when importKind is "git".';
  }

  if (settings.syncStatus !== undefined) {
    const syncStatus = settings.syncStatus;
    if (!syncStatus || typeof syncStatus !== 'object' || Array.isArray(syncStatus)) {
      return 'settings.syncStatus must be an object.';
    }
    const record = syncStatus as Record<string, unknown>;
    if (
      record.lastSyncStatus !== undefined &&
      record.lastSyncStatus !== 'idle' &&
      record.lastSyncStatus !== 'running' &&
      record.lastSyncStatus !== 'success' &&
      record.lastSyncStatus !== 'failed'
    ) {
      return 'settings.syncStatus.lastSyncStatus must be idle, running, success, or failed.';
    }
  }

  return null;
}

export function mergeSyncStatus(
  existing: Record<string, unknown>,
  syncStatus: SyncStatus,
): Record<string, unknown> {
  return {
    ...existing,
    syncStatus,
  };
}
