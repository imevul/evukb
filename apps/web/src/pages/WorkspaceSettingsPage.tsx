import type { MutationApprovalPolicy, SettingsResponse, WorkspaceBootHints } from '@evu/kb-sdk';
import { Alert, Button, EmptyState, StatusPill } from '@evu/kb-ui';
import { type FormEvent, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

type BootHintCard = {
  label: string;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  hint: string;
};

function buildBootHintCards(hints: WorkspaceBootHints): BootHintCard[] {
  return [
    {
      label: 'Database',
      status: hints.databaseConfigured ? 'Configured' : 'Not configured',
      tone: hints.databaseConfigured ? 'success' : 'danger',
      hint: 'Set EVUKB_DATABASE_URL on the API server.',
    },
    {
      label: 'Blob store',
      status: hints.blobStoreConfigured ? 'Configured' : 'Not configured',
      tone: hints.blobStoreConfigured ? 'success' : 'danger',
      hint: 'Set EVUKB_BLOB_ROOT on the API server.',
    },
    {
      label: 'Mount allowlist',
      status: hints.mountAllowlistConfigured ? 'Configured' : 'Not configured',
      tone: hints.mountAllowlistConfigured ? 'success' : 'neutral',
      hint: 'Optional unless using shared mount import (EVUKB_MOUNT_ALLOWLIST).',
    },
    {
      label: 'Secrets key',
      status: hints.secretsKeyConfigured ? 'Configured' : 'Not configured',
      tone: hints.secretsKeyConfigured ? 'success' : 'warning',
      hint: 'Required for git corpus credentials (EVUKB_SECRETS_KEY).',
    },
    {
      label: 'Mount authoritative mode',
      status: hints.mountAuthoritativeEnabled ? 'Enabled' : 'Disabled',
      tone: hints.mountAuthoritativeEnabled ? 'success' : 'neutral',
      hint: 'EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true on the API server.',
    },
    {
      label: 'Import writeback mode',
      status: hints.importWritebackEnabled ? 'Enabled' : 'Disabled',
      tone: hints.importWritebackEnabled ? 'success' : 'neutral',
      hint: 'EVUKB_ENABLE_IMPORT_WRITEBACK=true on the API server.',
    },
  ];
}

type ApprovalKey = keyof Required<MutationApprovalPolicy>;

const APPROVAL_KEYS: ApprovalKey[] = ['append', 'create', 'update', 'delete'];

const defaultApprovalPolicy: Required<MutationApprovalPolicy> = {
  append: 'never',
  create: 'always',
  update: 'always',
  delete: 'always',
};

function readApprovalPolicy(settings: Record<string, unknown>): Required<MutationApprovalPolicy> {
  const raw = settings.mutationApprovalPolicy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaultApprovalPolicy };
  }
  return {
    ...defaultApprovalPolicy,
    ...(raw as MutationApprovalPolicy),
  };
}

export function WorkspaceSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [name, setName] = useState('');
  const [approvalPolicy, setApprovalPolicy] = useState<Required<MutationApprovalPolicy>>({
    ...defaultApprovalPolicy,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .getSettings(appConfig.workspaceId)
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setName(loaded.name);
          setApprovalPolicy(readApprovalPolicy(loaded.settings));
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load settings.');
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

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const updated = await kbClient.updateSettings(appConfig.workspaceId, {
        name: name.trim(),
        settings: { mutationApprovalPolicy: approvalPolicy },
      });
      setSettings(updated);
      setName(updated.name);
      setApprovalPolicy(readApprovalPolicy(updated.settings));
      setMessage('Workspace settings saved.');
      setError(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Workspace settings" className="evukb-panel">
      <p>Workspace identity and environment-sourced boot configuration.</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading workspace settings…</p> : null}
      {!loading && !settings ? (
        <EmptyState title="Settings unavailable" hint="Check API connectivity and try again." />
      ) : null}
      {!loading && settings ? (
        <>
          <dl className="evukb-settings-dl">
            <div>
              <dt>Slug</dt>
              <dd>
                <code>{settings.slug}</code>
              </dd>
            </div>
            <div>
              <dt>Workspace ID</dt>
              <dd>
                <code>{settings.id}</code>
              </dd>
            </div>
          </dl>
          <form className="evukb-form" onSubmit={(event) => void handleSave(event)}>
            <label>
              Display name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <fieldset>
              <legend>Agent mutation approval</legend>
              <p className="evukb-form-hint">
                When set to always, matching agent writes create a pending approval instead of
                applying immediately. Corpus-level overrides can be set via the corpus settings API.
              </p>
              {APPROVAL_KEYS.map((key) => (
                <label key={key}>
                  {key}
                  <select
                    onChange={(event) =>
                      setApprovalPolicy((current) => ({
                        ...current,
                        [key]: event.target.value as Required<MutationApprovalPolicy>[ApprovalKey],
                      }))
                    }
                    value={approvalPolicy[key]}
                  >
                    <option value="never">never (apply immediately)</option>
                    <option value="always">always (require approval)</option>
                  </select>
                </label>
              ))}
            </fieldset>
            <Button disabled={submitting} type="submit" variant="primary">
              {submitting ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
          <h2 className="text-base font-semibold">Boot hints</h2>
          <p className="evukb-form-hint">
            Environment-sourced API boot configuration. These values are read from the server
            process, not from workspace settings.
          </p>
          <div className="evukb-stat-grid md:grid-cols-2 xl:grid-cols-3">
            {buildBootHintCards(settings.bootHints).map((item) => (
              <div className="evukb-stat-card" key={item.label}>
                <strong>{item.label}</strong>
                <p>
                  <StatusPill tone={item.tone}>{item.status}</StatusPill>
                </p>
                <p className="text-muted-foreground">{item.hint}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
