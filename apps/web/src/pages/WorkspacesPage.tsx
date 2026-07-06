import type { WorkspaceSummary } from '@evu/kb-sdk';
import { EvuKbApiError } from '@evu/kb-sdk';
import {
  Alert,
  AppModal,
  Button,
  EmptyState,
  Field,
  Input,
  Label,
  PageHeader,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmAction,
  useFormatDateTime,
} from '@evu/kb-ui';
import { Pencil, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appRoutes } from '../config.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

const createWorkspaceFormId = 'create-workspace-form';
const editWorkspaceFormId = 'edit-workspace-form';

type WorkspaceRow = WorkspaceSummary & {
  corpusCount: number | null;
};

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof EvuKbApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function WorkspacesPage() {
  const formatDateTime = useFormatDateTime();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSlug, setSelectedSlug, refresh: refreshWorkspace } = useWorkspace();
  const { confirm, confirmModal } = useConfirmAction();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<WorkspaceRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await kbClient.listWorkspaces();
      const rows = await Promise.all(
        items.map(async (item) => {
          try {
            const corpora = await kbClient.listCorpora(item.slug);
            return { ...item, corpusCount: corpora.length };
          } catch {
            return { ...item, corpusCount: null };
          }
        }),
      );
      setWorkspaces(rows);
    } catch (loadError) {
      setWorkspaces([]);
      setError(formatApiError(loadError, 'Failed to load workspaces.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function resetCreateForm(): void {
    setCreateSlug('');
    setCreateName('');
    setCreateError(null);
  }

  function openCreateModal(): void {
    resetCreateForm();
    setCreateOpen(true);
  }

  function closeCreateModal(): void {
    setCreateOpen(false);
    resetCreateForm();
  }

  function openEditModal(row: WorkspaceRow): void {
    setEditTarget(row);
    setEditName(row.name);
    setEditError(null);
  }

  function closeEditModal(): void {
    setEditTarget(null);
    setEditName('');
    setEditError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const created = await kbClient.createWorkspace({
        slug: createSlug.trim(),
        name: createName.trim(),
      });
      closeCreateModal();
      await loadWorkspaces();
      setSelectedSlug(created.slug);
      await refreshWorkspace();
      navigate(appRoutes.knowledgeList);
    } catch (submitError) {
      setCreateError(formatApiError(submitError, 'Failed to create workspace.'));
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editTarget) {
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      await kbClient.updateSettings(editTarget.slug, { name: editName.trim() });
      closeEditModal();
      await loadWorkspaces();
      if (editTarget.slug === selectedSlug) {
        await refreshWorkspace();
      }
    } catch (submitError) {
      setEditError(formatApiError(submitError, 'Failed to update workspace.'));
    } finally {
      setEditSubmitting(false);
    }
  }

  function handleSelect(slug: string): void {
    setSelectedSlug(slug);
    void refreshWorkspace();
    navigate(appRoutes.knowledgeList);
  }

  function handleDelete(row: WorkspaceRow): void {
    if (row.corpusCount && row.corpusCount > 0) {
      return;
    }
    confirm({
      title: `Delete workspace ${row.slug}?`,
      body: 'This cannot be undone. The workspace must have no corpora.',
      confirmLabel: 'Delete workspace',
      confirmingLabel: 'Deleting…',
      confirmVariant: 'danger',
      action: async () => {
        await kbClient.deleteWorkspace(row.slug);
        await loadWorkspaces();
        if (row.slug === selectedSlug) {
          await refreshWorkspace();
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button onClick={openCreateModal} type="button">
            Create workspace
          </Button>
        }
        description="Select, create, rename, or delete workspaces. Browser selection overrides the build-time default."
        title="Workspaces"
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {confirmModal}

      {loading ? (
        <p className="evukb-muted">Loading workspaces…</p>
      ) : workspaces.length === 0 ? (
        <EmptyState
          hint="Create a workspace to start indexing knowledge corpora."
          title="No workspaces yet"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Corpora</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((row) => {
              const isCurrent = row.slug === selectedSlug;
              const canDelete = row.corpusCount === 0;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code>{row.slug}</code>
                      {isCurrent ? <StatusPill tone="success">Current</StatusPill> : null}
                    </div>
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell>{row.corpusCount ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleSelect(row.slug)} size="sm" type="button">
                        Select
                      </Button>
                      <Button
                        aria-label={`Edit ${row.slug}`}
                        onClick={() => openEditModal(row)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${row.slug}`}
                        disabled={!canDelete}
                        onClick={() => handleDelete(row)}
                        size="sm"
                        title={
                          canDelete
                            ? 'Delete empty workspace'
                            : 'Delete is allowed only when the workspace has no corpora'
                        }
                        type="button"
                        variant="outline"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="evukb-muted text-sm">
        Need workspace settings? Open{' '}
        <Link to={appRoutes.settingsWorkspace}>workspace settings</Link> after selecting a workspace.
      </p>

      <AppModal
        footer={
          <>
            <Button onClick={closeCreateModal} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={createSubmitting} form={createWorkspaceFormId} type="submit">
              {createSubmitting ? 'Creating…' : 'Create workspace'}
            </Button>
          </>
        }
        onClose={closeCreateModal}
        open={createOpen}
        title="Create workspace"
      >
        <form className="flex flex-col gap-4" id={createWorkspaceFormId} onSubmit={handleCreate}>
          {createError ? <Alert variant="danger">{createError}</Alert> : null}
          <Field>
            <Label htmlFor="workspace-slug">Slug</Label>
            <Input
              autoComplete="off"
              id="workspace-slug"
              onChange={(event) => setCreateSlug(event.target.value)}
              pattern="[a-z0-9-]{2,64}"
              placeholder="ops-team"
              required
              value={createSlug}
            />
          </Field>
          <Field>
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              autoComplete="off"
              id="workspace-name"
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Ops team"
              required
              value={createName}
            />
          </Field>
        </form>
      </AppModal>

      <AppModal
        footer={
          <>
            <Button onClick={closeEditModal} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={editSubmitting} form={editWorkspaceFormId} type="submit">
              {editSubmitting ? 'Saving…' : 'Save name'}
            </Button>
          </>
        }
        onClose={closeEditModal}
        open={editTarget !== null}
        title="Edit workspace"
      >
        <form className="flex flex-col gap-4" id={editWorkspaceFormId} onSubmit={handleEdit}>
          {editError ? <Alert variant="danger">{editError}</Alert> : null}
          <Field>
            <Label htmlFor="edit-workspace-name">Name</Label>
            <Input
              autoComplete="off"
              id="edit-workspace-name"
              onChange={(event) => setEditName(event.target.value)}
              required
              value={editName}
            />
          </Field>
          <p className="evukb-muted m-0 text-sm">
            Slug <code>{editTarget?.slug}</code> cannot be changed.
          </p>
        </form>
      </AppModal>
    </div>
  );
}
