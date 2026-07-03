import type { CorpusArchiveImportResult, KnowledgeCorpus, SecretRecord } from '@evu/kb-sdk';
import {
  Alert,
  AppModal,
  Button,
  Card,
  EmptyState,
  Field,
  FORM_SELECT_CLASS,
  formatFileTreeBytes,
  Input,
  Label,
  PageHeader,
  removeStoredWorkspaceCorpusId,
  resolveFormatProfile,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormatDateTime,
} from '@evu/kb-ui';
import { FolderOpen, LayoutDashboard, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { kbClient } from '../api/client.js';
import { appConfig, appRoutes } from '../config.js';
import {
  ARCHIVE_IMPORT_ACCEPT,
  normalizeArchiveUploadFile,
  stemFromArchiveName,
} from '../lib/archive-import-normalize.js';

type FormatProfileChoice = 'generic' | 'okf';
type ImportKindChoice = 'managed' | 'mount' | 'git';
type MountModeChoice = 'import' | 'mount_authoritative' | 'import_writeback';

const createCorpusFormId = 'create-corpus-form';
const importCorpusFormId = 'import-corpus-form';

export function KnowledgeListPage() {
  const formatDateTime = useFormatDateTime();
  const [corpora, setCorpora] = useState<KnowledgeCorpus[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formatProfile, setFormatProfile] = useState<FormatProfileChoice>('generic');
  const [importKind, setImportKind] = useState<ImportKindChoice>('managed');
  const [mountPath, setMountPath] = useState('');
  const [mountMode, setMountMode] = useState<MountModeChoice>('import');
  const [mountAuthoritativeEnabled, setMountAuthoritativeEnabled] = useState(false);
  const [importWritebackEnabled, setImportWritebackEnabled] = useState(false);
  const [gitRemoteUrl, setGitRemoteUrl] = useState('');
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState('');
  const [gitCredentialSecretName, setGitCredentialSecretName] = useState('');
  const [secrets, setSecrets] = useState<SecretRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeCorpus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetCreateForm(): void {
    setName('');
    setDescription('');
    setFormatProfile('generic');
    setImportKind('managed');
    setMountPath('');
    setMountMode('import');
    setGitRemoteUrl('');
    setSyncIntervalMinutes('');
    setGitCredentialSecretName('');
    setCreateError(null);
  }

  function closeCreateModal(): void {
    setCreateOpen(false);
    resetCreateForm();
  }

  function openCreateModal(): void {
    resetCreateForm();
    setCreateOpen(true);
  }

  function resetImportForm(): void {
    setImportName('');
    setImportDescription('');
    setImportFile(null);
    setImportError(null);
  }

  function closeImportModal(): void {
    setImportOpen(false);
    resetImportForm();
  }

  function openImportModal(): void {
    resetImportForm();
    setImportOpen(true);
  }

  function handleImportFileChange(file: File | null): void {
    setImportFile(file);
    if (file && !importName.trim()) {
      setImportName(stemFromArchiveName(file.name));
    }
  }

  function openDeleteModal(corpus: KnowledgeCorpus): void {
    setDeleteError(null);
    setDeleteTarget(corpus);
  }

  function closeDeleteModal(): void {
    if (deleting) {
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleDeleteCorpus(): Promise<void> {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await kbClient.deleteCorpus(appConfig.workspaceId, deleteTarget.id);
      removeStoredWorkspaceCorpusId(appConfig.workspaceId, deleteTarget.id);
      setCorpora((current) => current.filter((corpus) => corpus.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteFailure: unknown) {
      setDeleteError(
        deleteFailure instanceof Error ? deleteFailure.message : 'Failed to delete corpus.',
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .listCorpora(appConfig.workspaceId)
      .then((items) => {
        if (!cancelled) {
          setCorpora(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load corpora.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void kbClient
      .getSettings(appConfig.workspaceId)
      .then((loaded) => {
        if (!cancelled) {
          setMountAuthoritativeEnabled(loaded.bootHints.mountAuthoritativeEnabled);
          setImportWritebackEnabled(loaded.bootHints.importWritebackEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMountAuthoritativeEnabled(false);
          setImportWritebackEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (importKind !== 'git') {
      return;
    }

    let cancelled = false;
    void kbClient
      .listSecrets(appConfig.workspaceId)
      .then((items) => {
        if (!cancelled) {
          setSecrets(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecrets([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [importKind]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    try {
      const settings: Record<string, unknown> = {};
      if (formatProfile === 'okf') {
        settings.formatProfile = 'okf';
      }
      if (importKind !== 'managed') {
        settings.importKind = importKind;
        if (importKind === 'mount') {
          settings.mountMode = mountMode;
        } else {
          settings.mountMode = 'import';
        }
      }
      if (importKind === 'mount' && mountPath.trim()) {
        settings.mountPath = mountPath.trim();
      }
      if (importKind === 'git' && gitRemoteUrl.trim()) {
        settings.gitRemoteUrl = gitRemoteUrl.trim();
      }
      if (importKind !== 'managed' && syncIntervalMinutes.trim()) {
        const interval = Number.parseInt(syncIntervalMinutes, 10);
        if (Number.isFinite(interval) && interval > 0) {
          settings.syncIntervalMinutes = interval;
        }
      }
      if (importKind === 'git' && gitCredentialSecretName) {
        settings.gitCredentialSecretName = gitCredentialSecretName;
      }

      const created = await kbClient.createCorpus(appConfig.workspaceId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(Object.keys(settings).length > 0 ? { settings } : {}),
      });
      const items = await kbClient.listCorpora(appConfig.workspaceId);
      setCorpora(items);
      setSuccessMessage(`Corpus “${created.name}” created.`);
      closeCreateModal();
    } catch (createError: unknown) {
      setCreateError(
        createError instanceof Error ? createError.message : 'Failed to create corpus.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function formatImportResult(result: CorpusArchiveImportResult): string {
    const parts = [
      `imported ${result.imported}`,
      `updated ${result.updated}`,
      `skipped ${result.skipped}`,
    ];
    if (result.mode === 'portable') {
      parts.push(`links ${result.linksRestored}`);
    }
    parts.push(`indexed ${result.indexed}`);
    if (result.warnings.length > 0) {
      parts.push(`${result.warnings.length} warning(s)`);
    }
    if (result.errors.length > 0) {
      parts.push(`${result.errors.length} error(s)`);
    }
    return parts.join(', ');
  }

  async function handleImport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!importName.trim() || !importFile) {
      return;
    }

    setImportSubmitting(true);
    setImportError(null);
    let createdCorpusId: string | null = null;
    try {
      const corpus = await kbClient.createCorpus(appConfig.workspaceId, {
        name: importName.trim(),
        ...(importDescription.trim() ? { description: importDescription.trim() } : {}),
      });
      createdCorpusId = corpus.id;
      const zipFile = await normalizeArchiveUploadFile(importFile);
      const result = await kbClient.importPortableZip(appConfig.workspaceId, corpus.id, zipFile);
      createdCorpusId = null;
      const items = await kbClient.listCorpora(appConfig.workspaceId);
      setCorpora(items);
      setSuccessMessage(
        `Imported “${corpus.name}” (${result.mode}): ${formatImportResult(result)}.`,
      );
      closeImportModal();
    } catch (importFailure: unknown) {
      if (createdCorpusId) {
        try {
          await kbClient.deleteCorpus(appConfig.workspaceId, createdCorpusId);
        } catch {
          // Keep the primary import error visible if cleanup fails.
        }
      }
      setImportError(
        importFailure instanceof Error ? importFailure.message : 'Failed to import corpus.',
      );
    } finally {
      setImportSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button onClick={openImportModal} type="button" variant="outline">
              Import
            </Button>
            <Button onClick={openCreateModal} type="button" variant="primary">
              Create corpus
            </Button>
          </>
        }
        title="Corpora"
      />
      <Card>
        {successMessage ? (
          <Alert
            onDismiss={() => setSuccessMessage(null)}
            title={successMessage}
            variant="success"
          />
        ) : null}
        {error ? <p className="evukb-error">{error}</p> : null}
        {loading ? <p className="evukb-muted">Loading corpora…</p> : null}
        {!loading && corpora.length === 0 ? (
          <EmptyState
            title="No corpora yet"
            hint="Create a corpus to start adding markdown files."
          />
        ) : null}
        {!loading && corpora.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Chunks</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corpora.map((corpus) => (
                <TableRow key={corpus.id}>
                  <TableCell className="min-w-[12rem] max-w-[24rem]">
                    <div className="min-w-0">
                      <Link
                        className="font-medium text-primary hover:underline"
                        to={appRoutes.corpusOverview(corpus.id)}
                      >
                        {corpus.name}
                      </Link>
                      <p
                        className="m-0 truncate text-xs text-muted-foreground"
                        title={corpus.description || undefined}
                      >
                        {corpus.description || 'No description.'}
                      </p>
                      <p
                        className="m-0 truncate font-mono text-[11px] text-muted-foreground/80"
                        title={corpus.id}
                      >
                        {corpus.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone="neutral">{resolveFormatProfile(corpus.settings)}</StatusPill>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone="neutral">{formatImportKindLabel(corpus.settings)}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{corpus.fileCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{corpus.chunkCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatFileTreeBytes(corpus.totalBytes)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(corpus.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        aria-label={`Open overview for ${corpus.name}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        to={appRoutes.corpusOverview(corpus.id)}
                      >
                        <LayoutDashboard aria-hidden className="h-4 w-4" />
                      </Link>
                      <Link
                        aria-label={`Open files for ${corpus.name}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        to={appRoutes.corpusFiles(corpus.id)}
                      >
                        <FolderOpen aria-hidden className="h-4 w-4" />
                      </Link>
                      <Button
                        aria-label={`Delete ${corpus.name}`}
                        onClick={() => openDeleteModal(corpus)}
                        size="icon"
                        type="button"
                        variant="dangerOutline"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        <AppModal
          footer={
            <>
              <Button
                disabled={submitting}
                onClick={closeCreateModal}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={submitting}
                form={createCorpusFormId}
                type="submit"
                variant="primary"
              >
                {submitting ? 'Creating…' : 'Create corpus'}
              </Button>
            </>
          }
          onClose={closeCreateModal}
          open={createOpen}
          title="Create corpus"
        >
          {createError ? <p className="evukb-error">{createError}</p> : null}
          <form
            className="evukb-form"
            id={createCorpusFormId}
            onSubmit={(event) => void handleCreate(event)}
          >
            <Field>
              <Label htmlFor="create-corpus-name">Name</Label>
              <Input
                id="create-corpus-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <Label htmlFor="create-corpus-description">Description</Label>
              <Input
                id="create-corpus-description"
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </Field>
            <Field>
              <Label htmlFor="create-corpus-format-profile">Format profile</Label>
              <select
                className={FORM_SELECT_CLASS}
                id="create-corpus-format-profile"
                value={formatProfile}
                onChange={(event) => setFormatProfile(event.target.value as FormatProfileChoice)}
              >
                <option value="generic">Generic markdown</option>
                <option value="okf">OKF</option>
              </select>
            </Field>
            <Field>
              <Label htmlFor="create-corpus-import-kind">Import kind</Label>
              <select
                className={FORM_SELECT_CLASS}
                id="create-corpus-import-kind"
                value={importKind}
                onChange={(event) => setImportKind(event.target.value as ImportKindChoice)}
              >
                <option value="managed">Managed uploads</option>
                <option value="mount">Shared mount import</option>
                <option value="git">Git repository import</option>
              </select>
            </Field>
            {importKind === 'mount' ? (
              <>
                <Field>
                  <Label htmlFor="create-corpus-mount-path">Mount path</Label>
                  <Input
                    id="create-corpus-mount-path"
                    onChange={(event) => setMountPath(event.target.value)}
                    value={mountPath}
                  />
                </Field>
                <Field>
                  <Label htmlFor="create-corpus-mount-mode">Mount sync mode</Label>
                  <select
                    className={FORM_SELECT_CLASS}
                    id="create-corpus-mount-mode"
                    value={mountMode}
                    onChange={(event) => setMountMode(event.target.value as MountModeChoice)}
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
                {!mountAuthoritativeEnabled ? (
                  <p className="evukb-muted">
                    Mount authoritative mode requires{' '}
                    <code>EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true</code> on the API server.
                  </p>
                ) : null}
                {!importWritebackEnabled ? (
                  <p className="evukb-muted">
                    Import writeback requires <code>EVUKB_ENABLE_IMPORT_WRITEBACK=true</code> on the
                    API server.
                  </p>
                ) : null}
                {mountMode === 'import_writeback' ? (
                  <p className="evukb-muted">
                    Managed file saves and deletes mirror to the mount (KB wins on conflict).
                  </p>
                ) : null}
                {mountMode === 'mount_authoritative' ? (
                  <p className="evukb-muted">
                    Managed files not present on the mount are deleted on each sync.
                  </p>
                ) : null}
              </>
            ) : null}
            {importKind === 'git' ? (
              <>
                <Field>
                  <Label htmlFor="create-corpus-git-remote">Git remote URL</Label>
                  <Input
                    id="create-corpus-git-remote"
                    onChange={(event) => setGitRemoteUrl(event.target.value)}
                    value={gitRemoteUrl}
                  />
                </Field>
                <Field>
                  <Label htmlFor="create-corpus-git-secret">Git credential secret</Label>
                  <select
                    className={FORM_SELECT_CLASS}
                    id="create-corpus-git-secret"
                    value={gitCredentialSecretName}
                    onChange={(event) => setGitCredentialSecretName(event.target.value)}
                  >
                    <option value="">None</option>
                    {secrets.map((secret) => (
                      <option key={secret.id} value={secret.name}>
                        {secret.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
            {importKind === 'mount' || importKind === 'git' ? (
              <Field>
                <Label htmlFor="create-corpus-sync-interval">
                  Sync interval (minutes, empty = manual only)
                </Label>
                <Input
                  id="create-corpus-sync-interval"
                  inputMode="numeric"
                  onChange={(event) => setSyncIntervalMinutes(event.target.value)}
                  value={syncIntervalMinutes}
                />
              </Field>
            ) : null}
          </form>
        </AppModal>

        <AppModal
          footer={
            <>
              <Button
                disabled={importSubmitting}
                onClick={closeImportModal}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={importSubmitting || !importFile}
                form={importCorpusFormId}
                type="submit"
                variant="primary"
              >
                {importSubmitting ? 'Importing…' : 'Import corpus'}
              </Button>
            </>
          }
          onClose={closeImportModal}
          open={importOpen}
          title="Import corpus"
        >
          {importError ? <p className="evukb-error">{importError}</p> : null}
          <form
            className="evukb-form"
            id={importCorpusFormId}
            onSubmit={(event) => void handleImport(event)}
          >
            <p className="evukb-muted">
              Upload an EvuKB portable export or a general archive (.evukb, .zip, .gz, or .tar.gz).
              A new corpus is created and populated from the archive. Entries under{' '}
              <code>.git/</code> are skipped automatically. Defaults allow 100 MiB compressed
              uploads and 500 MiB uncompressed archive content; raise{' '}
              <code>EVUKB_MAX_UPLOAD_BYTES</code> and/or <code>EVUKB_MAX_ARCHIVE_IMPORT_BYTES</code>{' '}
              on the API server for larger imports.
            </p>
            <Field>
              <Label htmlFor="import-corpus-name">Name</Label>
              <Input
                id="import-corpus-name"
                onChange={(event) => setImportName(event.target.value)}
                required
                value={importName}
              />
            </Field>
            <Field>
              <Label htmlFor="import-corpus-description">Description</Label>
              <Input
                id="import-corpus-description"
                onChange={(event) => setImportDescription(event.target.value)}
                value={importDescription}
              />
            </Field>
            <Field>
              <Label htmlFor="import-corpus-archive">Archive</Label>
              <Input
                accept={ARCHIVE_IMPORT_ACCEPT}
                id="import-corpus-archive"
                onChange={(event) => handleImportFileChange(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
            </Field>
          </form>
        </AppModal>

        <AppModal
          description="This permanently removes the corpus, its files, and search index data."
          footer={
            <>
              <Button
                disabled={deleting}
                onClick={closeDeleteModal}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={deleting}
                onClick={() => void handleDeleteCorpus()}
                type="button"
                variant="danger"
              >
                {deleting ? 'Deleting…' : 'Delete corpus'}
              </Button>
            </>
          }
          onClose={closeDeleteModal}
          open={deleteTarget !== null}
          size="sm"
          title={deleteTarget ? `Delete “${deleteTarget.name}”?` : 'Delete corpus'}
        >
          {deleteError ? <p className="evukb-error">{deleteError}</p> : null}
          {deleteTarget ? (
            <p>
              Delete <strong>{deleteTarget.name}</strong> and all {deleteTarget.fileCount} indexed
              files? This cannot be undone.
            </p>
          ) : null}
        </AppModal>
      </Card>
    </>
  );
}

function formatImportKindLabel(settings: Record<string, unknown>): string {
  switch (settings.importKind) {
    case 'mount':
      return 'Mount';
    case 'git':
      return 'Git';
    default:
      return 'Managed';
  }
}
