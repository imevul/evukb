import type { KbAuthScope } from '@evu/kb-sdk';
import {
  AppModal,
  Button,
  EmptyState,
  Input,
  Label,
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
import { RefreshCw, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactElement, type ReactNode, useEffect, useState } from 'react';

import { KbAuthScopeField, kbAuthScopesFromSelection } from '../../components/KbAuthScopePicker.js';
import { SecretRevealBanner } from '../../components/SecretRevealBanner.js';

const defaultCredentialScopes = (): Set<KbAuthScope> => new Set(['kb:read']);

export interface CredentialRecord {
  id: string;
  name: string;
  scopes: KbAuthScope[];
  expiresAt: string | null;
  createdAt: string;
}

export interface CredentialTokensPageConfig<
  TRecord extends CredentialRecord,
  TCreated extends TRecord,
> {
  formId: string;
  idPrefix: string;
  heading: string;
  intro: string;
  createButtonLabel: string;
  submitLabel: string;
  modalTitle: string;
  scopeHint: string;
  secretBannerLabel: string;
  loadingText: string;
  emptyTitle: string;
  emptyHint: string;
  loadErrorFallback: string;
  createErrorFallback: string;
  rotateErrorFallback: string;
  revokeBody: string;
  revokeConfirmLabel: string;
  rotateBody: string;
  rotateConfirmLabel: string;
  list: () => Promise<TRecord[]>;
  create: (input: { name: string; scopes: KbAuthScope[] }) => Promise<TCreated>;
  revoke: (id: string) => Promise<void>;
  rotate: (id: string) => Promise<TCreated>;
  secretOf: (created: TCreated) => string;
  renderLayout?: (panel: ReactNode, createdSecret: TCreated | null) => ReactElement;
}

export function CredentialTokensPage<TRecord extends CredentialRecord, TCreated extends TRecord>({
  config,
}: {
  config: CredentialTokensPageConfig<TRecord, TCreated>;
}) {
  const formatDateTime = useFormatDateTime();
  const [records, setRecords] = useState<TRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<KbAuthScope>>(defaultCredentialScopes);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<TCreated | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rotatingRecordId, setRotatingRecordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const { confirm, confirmModal } = useConfirmAction();

  function resetCreateForm(): void {
    setName('');
    setSelectedScopes(defaultCredentialScopes());
    setScopeError(null);
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void config
      .list()
      .then((items) => {
        if (!cancelled) {
          setRecords(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : config.loadErrorFallback);
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
  }, [config]);

  async function refreshRecords(): Promise<void> {
    const items = await config.list();
    setRecords(items);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const scopes = kbAuthScopesFromSelection(selectedScopes);
    if (scopes.length === 0) {
      setScopeError('Select at least one scope.');
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    setScopeError(null);
    try {
      const created = await config.create({
        name: name.trim(),
        scopes,
      });
      setCreatedSecret(created);
      await refreshRecords();
      closeCreateModal();
    } catch (createError: unknown) {
      setCreateError(
        createError instanceof Error ? createError.message : config.createErrorFallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openRevokeConfirm(record: TRecord): void {
    confirm({
      title: `Revoke “${record.name}”?`,
      body: <p>{config.revokeBody}</p>,
      confirmLabel: config.revokeConfirmLabel,
      confirmingLabel: 'Revoking…',
      action: async () => {
        await config.revoke(record.id);
        if (createdSecret?.id === record.id) {
          setCreatedSecret(null);
        }
        await refreshRecords();
        setError(null);
      },
    });
  }

  function openRotateConfirm(record: TRecord): void {
    confirm({
      title: `Rotate “${record.name}”?`,
      body: <p>{config.rotateBody}</p>,
      confirmLabel: config.rotateConfirmLabel,
      confirmingLabel: 'Rotating…',
      action: async () => {
        setRotatingRecordId(record.id);
        try {
          const rotated = await config.rotate(record.id);
          setCreatedSecret(rotated);
          await refreshRecords();
          setError(null);
        } catch (rotateError: unknown) {
          setError(rotateError instanceof Error ? rotateError.message : config.rotateErrorFallback);
          throw rotateError;
        } finally {
          setRotatingRecordId(null);
        }
      },
    });
  }

  const panel = (
    <section className="evukb-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2>{config.heading}</h2>
        <Button onClick={openCreateModal} type="button" variant="primary">
          {config.createButtonLabel}
        </Button>
      </div>
      <p>{config.intro}</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {createdSecret ? (
        <SecretRevealBanner
          label={config.secretBannerLabel}
          value={config.secretOf(createdSecret)}
        />
      ) : null}
      {loading ? <p className="evukb-muted">{config.loadingText}</p> : null}
      {!loading && records.length === 0 ? (
        <EmptyState title={config.emptyTitle} hint={config.emptyHint} />
      ) : null}
      {!loading && records.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="min-w-[10rem]">
                  <div className="min-w-0">
                    <strong className="font-medium">{record.name}</strong>
                    <p
                      className="m-0 truncate font-mono text-[11px] text-muted-foreground/80"
                      title={record.id}
                    >
                      {record.id}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {record.scopes.length > 0 ? (
                      record.scopes.map((scope) => (
                        <StatusPill key={scope} tone="neutral">
                          {scope}
                        </StatusPill>
                      ))
                    ) : (
                      <span className="text-muted-foreground">none</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {record.expiresAt ? formatDateTime(record.expiresAt) : 'Never'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(record.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      aria-label={`Rotate ${record.name}`}
                      disabled={rotatingRecordId === record.id}
                      onClick={() => openRotateConfirm(record)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw
                        aria-hidden
                        className={`h-4 w-4${rotatingRecordId === record.id ? ' animate-spin' : ''}`}
                      />
                    </Button>
                    <Button
                      aria-label={`Revoke ${record.name}`}
                      onClick={() => openRevokeConfirm(record)}
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
            <Button disabled={submitting} form={config.formId} type="submit" variant="primary">
              {submitting ? 'Creating…' : config.submitLabel}
            </Button>
          </>
        }
        onClose={closeCreateModal}
        open={createOpen}
        title={config.modalTitle}
      >
        {createError ? <p className="evukb-error">{createError}</p> : null}
        <form
          className="evukb-form"
          id={config.formId}
          onSubmit={(event) => void handleCreate(event)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${config.idPrefix}-name`}>Name</Label>
            <Input
              id={`${config.idPrefix}-name`}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <KbAuthScopeField
            error={scopeError}
            hint={config.scopeHint}
            idPrefix={config.idPrefix}
            label="Scopes"
            onChange={(next) => {
              setSelectedScopes(next);
              if (next.size > 0) {
                setScopeError(null);
              }
            }}
            selected={selectedScopes}
          />
        </form>
      </AppModal>
      {confirmModal}
    </section>
  );

  if (config.renderLayout) {
    return config.renderLayout(panel, createdSecret);
  }

  return panel;
}
