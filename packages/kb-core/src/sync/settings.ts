import type { ImportKind, MountSyncMode, SyncStatus, SyncStatusValue } from './types.js';

export type CorpusSyncSettings = {
  importKind?: ImportKind;
  mountPath?: string;
  mountMode?: MountSyncMode;
  gitRemoteUrl?: string;
  gitRef?: string;
  gitCredentialSecretName?: string;
  gitWritebackEnabled?: boolean;
  gitPushEnabled?: boolean;
  gitWritebackBranch?: string;
  gitWritebackUseFeatureBranch?: boolean;
  gitWritebackAllowDefaultBranch?: boolean;
  gitAuthorName?: string;
  gitAuthorEmail?: string;
  gitAuthorSecretName?: string;
  syncIntervalMinutes?: number;
  syncStatus?: SyncStatus;
};

const IMPORT_KINDS: ImportKind[] = ['managed', 'mount', 'git'];
const MOUNT_MODES: MountSyncMode[] = ['import', 'mount_authoritative', 'import_writeback'];
const SYNC_STATUS_VALUES: SyncStatusValue[] = [
  'idle',
  'running',
  'success',
  'failed',
  'writeback_blocked',
];

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
    typeof record.lastSyncStatus === 'string' &&
    SYNC_STATUS_VALUES.includes(record.lastSyncStatus as SyncStatusValue)
  ) {
    status.lastSyncStatus = record.lastSyncStatus as SyncStatusValue;
  }
  if (typeof record.lastSyncError === 'string') {
    status.lastSyncError = record.lastSyncError;
  }
  if (typeof record.lastCommitSha === 'string') {
    status.lastCommitSha = record.lastCommitSha;
  }
  if (typeof record.lastWritebackAt === 'string') {
    status.lastWritebackAt = record.lastWritebackAt;
  }
  if (typeof record.lastWritebackError === 'string') {
    status.lastWritebackError = record.lastWritebackError;
  }
  return Object.keys(status).length > 0 ? status : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === false) {
    return value;
  }
  return undefined;
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

  const gitWritebackEnabled = parseOptionalBoolean(settings.gitWritebackEnabled);
  if (gitWritebackEnabled !== undefined) {
    parsed.gitWritebackEnabled = gitWritebackEnabled;
  }

  const gitPushEnabled = parseOptionalBoolean(settings.gitPushEnabled);
  if (gitPushEnabled !== undefined) {
    parsed.gitPushEnabled = gitPushEnabled;
  }

  if (typeof settings.gitWritebackBranch === 'string' && settings.gitWritebackBranch.trim()) {
    parsed.gitWritebackBranch = settings.gitWritebackBranch.trim();
  }

  const gitWritebackUseFeatureBranch = parseOptionalBoolean(settings.gitWritebackUseFeatureBranch);
  if (gitWritebackUseFeatureBranch !== undefined) {
    parsed.gitWritebackUseFeatureBranch = gitWritebackUseFeatureBranch;
  }

  const gitWritebackAllowDefaultBranch = parseOptionalBoolean(
    settings.gitWritebackAllowDefaultBranch,
  );
  if (gitWritebackAllowDefaultBranch !== undefined) {
    parsed.gitWritebackAllowDefaultBranch = gitWritebackAllowDefaultBranch;
  }

  if (typeof settings.gitAuthorName === 'string' && settings.gitAuthorName.trim()) {
    parsed.gitAuthorName = settings.gitAuthorName.trim();
  }

  if (typeof settings.gitAuthorEmail === 'string' && settings.gitAuthorEmail.trim()) {
    parsed.gitAuthorEmail = settings.gitAuthorEmail.trim();
  }

  if (typeof settings.gitAuthorSecretName === 'string' && settings.gitAuthorSecretName.trim()) {
    parsed.gitAuthorSecretName = settings.gitAuthorSecretName.trim();
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

export function resolveGitWritebackFeatureBranch(corpusId: string): string {
  return `evukb/writeback/${corpusId}`;
}

export function resolveGitWritebackBranch(
  settings: Record<string, unknown>,
  corpusId: string,
): string {
  const sync = parseCorpusSyncSettings(settings);
  if (sync.gitWritebackUseFeatureBranch) {
    return resolveGitWritebackFeatureBranch(corpusId);
  }
  if (sync.gitWritebackBranch) {
    return sync.gitWritebackBranch;
  }
  return resolveGitRef(settings);
}

export function isGitWritebackDefaultBranchTarget(
  settings: Record<string, unknown>,
  corpusId: string,
): boolean {
  const target = resolveGitWritebackBranch(settings, corpusId);
  const defaultBranch = resolveGitRef(settings);
  return target === defaultBranch;
}

export function validateSyncSettings(
  settings: Record<string, unknown>,
  options: {
    allowMountAuthoritative?: boolean;
    allowImportWriteback?: boolean;
    allowGitWriteback?: boolean;
  } = {},
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

  if (
    settings.gitWritebackEnabled !== undefined &&
    typeof settings.gitWritebackEnabled !== 'boolean'
  ) {
    return 'settings.gitWritebackEnabled must be a boolean.';
  }
  if (settings.gitWritebackEnabled === true) {
    if (!options.allowGitWriteback) {
      return 'settings.gitWritebackEnabled requires EVUKB_ENABLE_GIT_WRITEBACK=true.';
    }
    if (importKind !== undefined && importKind !== 'git') {
      return 'settings.gitWritebackEnabled requires settings.importKind "git".';
    }
  }

  if (settings.gitPushEnabled !== undefined && typeof settings.gitPushEnabled !== 'boolean') {
    return 'settings.gitPushEnabled must be a boolean.';
  }

  if (
    settings.gitWritebackBranch !== undefined &&
    typeof settings.gitWritebackBranch !== 'string'
  ) {
    return 'settings.gitWritebackBranch must be a string.';
  }

  if (
    settings.gitWritebackUseFeatureBranch !== undefined &&
    typeof settings.gitWritebackUseFeatureBranch !== 'boolean'
  ) {
    return 'settings.gitWritebackUseFeatureBranch must be a boolean.';
  }

  if (
    settings.gitWritebackAllowDefaultBranch !== undefined &&
    typeof settings.gitWritebackAllowDefaultBranch !== 'boolean'
  ) {
    return 'settings.gitWritebackAllowDefaultBranch must be a boolean.';
  }

  if (settings.gitAuthorName !== undefined && typeof settings.gitAuthorName !== 'string') {
    return 'settings.gitAuthorName must be a string.';
  }

  if (settings.gitAuthorEmail !== undefined && typeof settings.gitAuthorEmail !== 'string') {
    return 'settings.gitAuthorEmail must be a string.';
  }

  if (
    settings.gitAuthorSecretName !== undefined &&
    typeof settings.gitAuthorSecretName !== 'string'
  ) {
    return 'settings.gitAuthorSecretName must be a string.';
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
      (typeof record.lastSyncStatus !== 'string' ||
        !SYNC_STATUS_VALUES.includes(record.lastSyncStatus as SyncStatusValue))
    ) {
      return 'settings.syncStatus.lastSyncStatus must be idle, running, success, failed, or writeback_blocked.';
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
