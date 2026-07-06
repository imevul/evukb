import type { CreatedSecret, SecretRecord } from '@evu/kb-sdk';
import {
  Alert,
  AppModal,
  Button,
  EmptyState,
  Field,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmAction,
  useFormatDateTime,
} from '@evu/kb-ui';
import { RefreshCw, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { SecretRevealBanner } from '../components/SecretRevealBanner.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

const createSecretFormId = 'create-secret-form';
const rotateSecretFormId = 'rotate-secret-form';

export function SecretsPage() {
  const { selectedSlug } = useWorkspace();
  const formatDateTime = useFormatDateTime();
  const [secrets, setSecrets] = useState<SecretRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [createdSecret, setCreatedSecret] = useState<CreatedSecret | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<SecretRecord | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { confirm, confirmModal } = useConfirmAction();

  function resetCreateForm(): void {
    setName('');
    setValue('');
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

  function openRotateModal(secret: SecretRecord): void {
    setRotateValue('');
    setRotateError(null);
    setRotateTarget(secret);
  }

  function closeRotateModal(): void {
    if (rotating) {
      return;
    }
    setRotateTarget(null);
    setRotateValue('');
    setRotateError(null);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .listSecrets(selectedSlug)
      .then((items) => {
        if (!cancelled) {
          setSecrets(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load secrets.');
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
  }, [selectedSlug]);

  async function refreshSecrets(): Promise<void> {
    const items = await kbClient.listSecrets(selectedSlug);
    setSecrets(items);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim() || !value) {
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await kbClient.createSecret(selectedSlug, {
        name: name.trim(),
        value,
      });
      setCreatedSecret(created);
      setSuccessMessage(`Secret “${created.name}” created.`);
      await refreshSecrets();
      closeCreateModal();
    } catch (createError: unknown) {
      setCreateError(
        createError instanceof Error ? createError.message : 'Failed to create secret.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const target = rotateTarget;
    const nextValue = rotateValue.trim();
    if (!target || !nextValue) {
      return;
    }

    setRotating(true);
    setRotateError(null);
    try {
      const rotated = await kbClient.rotateSecret(selectedSlug, target.id, {
        value: nextValue,
      });
      setCreatedSecret({ ...rotated, value: nextValue });
      setSuccessMessage(`Secret “${target.name}” value replaced.`);
      await refreshSecrets();
      setRotating(false);
      closeRotateModal();
    } catch (rotateFailure: unknown) {
      setRotateError(
        rotateFailure instanceof Error ? rotateFailure.message : 'Failed to rotate secret.',
      );
      setRotating(false);
    }
  }

  function openDeleteConfirm(secret: SecretRecord): void {
    confirm({
      title: `Delete “${secret.name}”?`,
      body: <p>Permanently remove this secret. Git corpora using it will lose credentials.</p>,
      confirmLabel: 'Delete secret',
      confirmingLabel: 'Deleting…',
      action: async () => {
        await kbClient.deleteSecret(selectedSlug, secret.id);
        if (createdSecret?.id === secret.id) {
          setCreatedSecret(null);
        }
        await refreshSecrets();
        setError(null);
      },
    });
  }

  return (
    <section className="evukb-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2>Secrets</h2>
        <Button onClick={openCreateModal} type="button" variant="primary">
          Create secret
        </Button>
      </div>
      <p>
        Workspace-scoped credentials for git sync. Values are shown once on create or rotate. Set{' '}
        <code>EVUKB_SECRETS_KEY</code> in the repository root <code>.env</code> (32-byte hex,
        base64, or any string — hashed to 32 bytes) and recreate the API container after changes.
      </p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {successMessage ? (
        <Alert onDismiss={() => setSuccessMessage(null)} title={successMessage} variant="success" />
      ) : null}
      {createdSecret ? (
        <SecretRevealBanner label="Copy this secret value now:" value={createdSecret.value} />
      ) : null}
      {loading ? <p className="evukb-muted">Loading secrets…</p> : null}
      {!loading && secrets.length === 0 ? (
        <EmptyState title="No secrets yet" hint="Create a secret for git corpus credentials." />
      ) : null}
      {!loading && secrets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((secret) => (
              <TableRow key={secret.id}>
                <TableCell className="min-w-[10rem]">
                  <div className="min-w-0">
                    <strong className="font-medium">{secret.name}</strong>
                    <p
                      className="m-0 truncate font-mono text-[11px] text-muted-foreground/80"
                      title={secret.id}
                    >
                      {secret.id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(secret.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      aria-label={`Rotate ${secret.name}`}
                      disabled={rotating && rotateTarget?.id === secret.id}
                      onClick={() => openRotateModal(secret)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw
                        aria-hidden
                        className={`h-4 w-4${
                          rotating && rotateTarget?.id === secret.id ? ' animate-spin' : ''
                        }`}
                      />
                    </Button>
                    <Button
                      aria-label={`Delete ${secret.name}`}
                      onClick={() => openDeleteConfirm(secret)}
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
            <Button disabled={submitting} form={createSecretFormId} type="submit" variant="primary">
              {submitting ? 'Creating…' : 'Create secret'}
            </Button>
          </>
        }
        onClose={closeCreateModal}
        open={createOpen}
        title="Create secret"
      >
        {createError ? <p className="evukb-error">{createError}</p> : null}
        <form
          className="evukb-form"
          id={createSecretFormId}
          onSubmit={(event) => void handleCreate(event)}
        >
          <Field>
            <Label htmlFor="create-secret-name">Name</Label>
            <Input
              id="create-secret-name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </Field>
          <Field>
            <Label htmlFor="create-secret-value">Value</Label>
            <Input
              id="create-secret-value"
              onChange={(event) => setValue(event.target.value)}
              required
              type="password"
              value={value}
            />
          </Field>
        </form>
      </AppModal>

      <AppModal
        description="The previous value cannot be recovered. The new value is shown once after rotation."
        footer={
          <>
            <Button disabled={rotating} onClick={closeRotateModal} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={rotating || !rotateValue.trim()}
              form={rotateSecretFormId}
              type="submit"
              variant="primary"
            >
              {rotating ? 'Replacing…' : 'Replace secret'}
            </Button>
          </>
        }
        onClose={closeRotateModal}
        open={rotateTarget !== null}
        size="sm"
        title={rotateTarget ? `Rotate “${rotateTarget.name}”?` : 'Rotate secret'}
      >
        {rotateError ? <p className="evukb-error">{rotateError}</p> : null}
        <form
          className="evukb-form"
          id={rotateSecretFormId}
          onSubmit={(event) => void handleRotate(event)}
        >
          <Field>
            <Label htmlFor="rotate-secret-value">New value</Label>
            <Input
              disabled={rotating}
              id="rotate-secret-value"
              onChange={(event) => setRotateValue(event.target.value)}
              placeholder="New value"
              required
              type="password"
              value={rotateValue}
            />
          </Field>
        </form>
      </AppModal>
      {confirmModal}
    </section>
  );
}
