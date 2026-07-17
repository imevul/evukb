import type { KnowledgeCorpus, KnowledgeCorpusStats } from '@evu/kb-sdk';
import {
  Button,
  Card,
  Field,
  FORM_SELECT_CLASS,
  Input,
  Label,
  StatusPill,
  Switch,
  useFormatDateTime,
} from '@evu/kb-ui';
import type { MountModeChoice } from './corpus-settings.js';

interface CorpusSummaryCardProps {
  corpus: KnowledgeCorpus | null;
  stats: KnowledgeCorpusStats;
  importKind: NonNullable<KnowledgeCorpusStats['importKind']>;
  formatProfile: string;
  isOkfCorpus: boolean;
  okfStrictEnabled: boolean;
  syncIntervalMinutes: number | null;
  nextDueAt: string | null;
  syncing: boolean;
  reindexing: boolean;
  okfBusy: boolean;
  settingsSaving: boolean;
  syncIntervalInput: string;
  setSyncIntervalInput: (value: string) => void;
  mountModeInput: MountModeChoice;
  setMountModeInput: (value: MountModeChoice) => void;
  mountAuthoritativeEnabled: boolean;
  importWritebackEnabled: boolean;
  gitWritebackEnvEnabled: boolean;
  gitWritebackEnabled: boolean;
  setGitWritebackEnabled: (value: boolean) => void;
  gitPushEnabled: boolean;
  setGitPushEnabled: (value: boolean) => void;
  gitWritebackAllowDefaultBranch: boolean;
  setGitWritebackAllowDefaultBranch: (value: boolean) => void;
  gitWritebackUseFeatureBranch: boolean;
  setGitWritebackUseFeatureBranch: (value: boolean) => void;
  gitAuthorName: string;
  setGitAuthorName: (value: string) => void;
  gitAuthorEmail: string;
  setGitAuthorEmail: (value: string) => void;
  runSync: (action: 'mount' | 'git') => Promise<void>;
  saveSyncInterval: () => Promise<void>;
  saveMountMode: () => Promise<void>;
  saveGitWriteback: () => Promise<void>;
  toggleOkfStrict: (enabled: boolean) => Promise<void>;
}

export function CorpusSummaryCard({
  corpus,
  stats,
  importKind,
  formatProfile,
  isOkfCorpus,
  okfStrictEnabled,
  syncIntervalMinutes,
  nextDueAt,
  syncing,
  reindexing,
  okfBusy,
  settingsSaving,
  syncIntervalInput,
  setSyncIntervalInput,
  mountModeInput,
  setMountModeInput,
  mountAuthoritativeEnabled,
  importWritebackEnabled,
  gitWritebackEnvEnabled,
  gitWritebackEnabled,
  setGitWritebackEnabled,
  gitPushEnabled,
  setGitPushEnabled,
  gitWritebackAllowDefaultBranch,
  setGitWritebackAllowDefaultBranch,
  gitWritebackUseFeatureBranch,
  setGitWritebackUseFeatureBranch,
  gitAuthorName,
  setGitAuthorName,
  gitAuthorEmail,
  setGitAuthorEmail,
  runSync,
  saveSyncInterval,
  saveMountMode,
  saveGitWriteback,
  toggleOkfStrict,
}: CorpusSummaryCardProps) {
  const formatDateTime = useFormatDateTime();
  const writebackBlocked = stats.syncStatus?.lastSyncStatus === 'writeback_blocked';

  return (
    <Card>
      <h2 className="text-lg font-semibold leading-none">Corpus</h2>
      {corpus ? (
        <p className="evukb-corpus-meta">
          Import kind: <StatusPill tone="neutral">{importKind}</StatusPill>
          {stats.syncStatus?.lastSyncAt ? (
            <>
              {' '}
              Last sync:{' '}
              <StatusPill tone={writebackBlocked ? 'warning' : 'neutral'}>
                {stats.syncStatus.lastSyncStatus ?? 'unknown'}
              </StatusPill>{' '}
              at {formatDateTime(stats.syncStatus.lastSyncAt)}
            </>
          ) : null}
          {stats.syncStatus?.lastCommitSha ? (
            <> ({stats.syncStatus.lastCommitSha.slice(0, 7)})</>
          ) : null}
        </p>
      ) : null}
      {writebackBlocked && stats.syncStatus?.lastWritebackError ? (
        <p className="evukb-form-hint">
          Git writeback blocked: {stats.syncStatus.lastWritebackError}
        </p>
      ) : null}
      {corpus ? (
        <p className="evukb-corpus-meta">
          Format profile:{' '}
          <StatusPill tone={isOkfCorpus ? 'warning' : 'neutral'}>{formatProfile}</StatusPill>
          {stats.okfIssueCount > 0 ? (
            <>
              {' '}
              <StatusPill tone="warning">{stats.okfIssueCount} OKF issues</StatusPill>
            </>
          ) : null}
          {stats.citationIssueCount > 0 ? (
            <>
              {' '}
              <StatusPill tone="warning">{stats.citationIssueCount} citation issues</StatusPill>
            </>
          ) : null}
        </p>
      ) : null}
      {importKind === 'mount' || importKind === 'git' ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={syncing || reindexing || okfBusy}
              onClick={() => void runSync(importKind)}
              type="button"
              variant="outline"
            >
              {syncing ? 'Syncing…' : importKind === 'mount' ? 'Sync mount now' : 'Sync git now'}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(12rem,16rem)_auto] md:items-end">
            <Field>
              <Label htmlFor="corpus-sync-interval">Sync interval (minutes)</Label>
              <Input
                disabled={settingsSaving}
                id="corpus-sync-interval"
                inputMode="numeric"
                value={syncIntervalInput}
                onChange={(event) => setSyncIntervalInput(event.target.value)}
              />
            </Field>
            <Button
              className="md:self-end"
              disabled={settingsSaving || syncing}
              onClick={() => void saveSyncInterval()}
              type="button"
              variant="outline"
            >
              {settingsSaving ? 'Saving…' : 'Save interval'}
            </Button>
          </div>
          {syncIntervalMinutes ? (
            <p className="evukb-form-hint">
              Scheduled every {syncIntervalMinutes} min
              {nextDueAt ? ` · next due ~${nextDueAt}` : ''}
            </p>
          ) : (
            <p className="evukb-form-hint">Manual sync only (no interval set).</p>
          )}
          {importKind === 'mount' ? (
            <>
              <div className="grid gap-4 md:grid-cols-[minmax(16rem,24rem)_auto] md:items-end">
                <Field>
                  <Label htmlFor="corpus-mount-mode">Mount sync mode</Label>
                  <select
                    className={FORM_SELECT_CLASS}
                    disabled={settingsSaving || syncing}
                    id="corpus-mount-mode"
                    onChange={(event) => setMountModeInput(event.target.value as MountModeChoice)}
                    value={mountModeInput}
                  >
                    <option value="import">Import (mount is read-only in KB)</option>
                    <option disabled={!mountAuthoritativeEnabled} value="mount_authoritative">
                      Mount authoritative (mount is source of truth)
                    </option>
                    <option disabled={!importWritebackEnabled} value="import_writeback">
                      Import with writeback (managed edits mirror to mount)
                    </option>
                  </select>
                </Field>
                <Button
                  className="md:self-end"
                  disabled={settingsSaving || syncing}
                  onClick={() => void saveMountMode()}
                  type="button"
                  variant="outline"
                >
                  {settingsSaving ? 'Saving…' : 'Save mount mode'}
                </Button>
              </div>
              {!mountAuthoritativeEnabled ? (
                <p className="evukb-form-hint">
                  Authoritative mode requires <code>EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true</code>.
                </p>
              ) : null}
              {!importWritebackEnabled ? (
                <p className="evukb-form-hint">
                  Writeback requires <code>EVUKB_ENABLE_IMPORT_WRITEBACK=true</code>.
                </p>
              ) : null}
              {mountModeInput === 'import_writeback' ? (
                <p className="evukb-form-hint">
                  Managed saves and deletes mirror to mount (KB wins on conflict).
                </p>
              ) : null}
              {mountModeInput === 'mount_authoritative' ? (
                <p className="evukb-form-hint">
                  Managed files not on the mount are deleted on sync.
                </p>
              ) : null}
            </>
          ) : null}
          {importKind === 'git' ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Git writeback</p>
              {!gitWritebackEnvEnabled ? (
                <p className="evukb-form-hint">
                  Requires <code>EVUKB_ENABLE_GIT_WRITEBACK=true</code> on the API server.
                </p>
              ) : null}
              <p className="evukb-checkbox">
                <Switch
                  aria-label="Enable git writeback"
                  checked={gitWritebackEnabled}
                  disabled={settingsSaving || syncing || !gitWritebackEnvEnabled}
                  onCheckedChange={setGitWritebackEnabled}
                />
                <span>Enable writeback (edit git files in KB and commit to cache)</span>
              </p>
              <p className="evukb-checkbox">
                <Switch
                  aria-label="Push after commit"
                  checked={gitPushEnabled}
                  disabled={settingsSaving || syncing || !gitWritebackEnabled}
                  onCheckedChange={setGitPushEnabled}
                />
                <span>Push commits to remote</span>
              </p>
              <p className="evukb-checkbox">
                <Switch
                  aria-label="Use feature branch"
                  checked={gitWritebackUseFeatureBranch}
                  disabled={settingsSaving || syncing || !gitWritebackEnabled}
                  onCheckedChange={setGitWritebackUseFeatureBranch}
                />
                <span>Use feature branch (evukb/writeback/…)</span>
              </p>
              <p className="evukb-checkbox">
                <Switch
                  aria-label="Allow default branch commits"
                  checked={gitWritebackAllowDefaultBranch}
                  disabled={
                    settingsSaving ||
                    syncing ||
                    !gitWritebackEnabled ||
                    gitWritebackUseFeatureBranch
                  }
                  onCheckedChange={setGitWritebackAllowDefaultBranch}
                />
                <span>Allow commits on the default branch</span>
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <Label htmlFor="corpus-git-author-name">Commit author name</Label>
                  <Input
                    disabled={settingsSaving || !gitWritebackEnabled}
                    id="corpus-git-author-name"
                    value={gitAuthorName}
                    onChange={(event) => setGitAuthorName(event.target.value)}
                  />
                </Field>
                <Field>
                  <Label htmlFor="corpus-git-author-email">Commit author email</Label>
                  <Input
                    disabled={settingsSaving || !gitWritebackEnabled}
                    id="corpus-git-author-email"
                    value={gitAuthorEmail}
                    onChange={(event) => setGitAuthorEmail(event.target.value)}
                  />
                </Field>
              </div>
              <Button
                disabled={settingsSaving || syncing || !gitWritebackEnvEnabled}
                onClick={() => void saveGitWriteback()}
                type="button"
                variant="outline"
              >
                {settingsSaving ? 'Saving…' : 'Save git writeback'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {isOkfCorpus ? (
        <p className="evukb-corpus-meta">
          <span className="evukb-checkbox">
            <Switch
              aria-label="Strict OKF"
              checked={okfStrictEnabled}
              disabled={settingsSaving || okfBusy || reindexing}
              onCheckedChange={(checked) => void toggleOkfStrict(checked)}
            />
            <span>Strict OKF</span>
          </span>
          <span className="evukb-muted"> Block saves when OKF validation issues are present.</span>
        </p>
      ) : null}
    </Card>
  );
}
