import type { MutationApprovalPolicy, SettingsResponse } from '@evu/kb-sdk';
import { Alert, Button, EmptyState, Switch } from '@evu/kb-ui';
import { type FormEvent, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';
import {
  formatAgentWritePathPrefixesInput,
  parseAgentWritePathPrefixesInput,
  readWorkspaceAgentWritePathPrefixes,
} from './corpus-overview/corpus-settings.js';

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

function readIncludeAgentNotesInRetrieval(settings: Record<string, unknown>): boolean {
  return settings.includeAgentNotesInRetrieval !== false;
}

export function WorkspaceSettingsPage() {
  const { selectedSlug } = useWorkspace();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [name, setName] = useState('');
  const [includeAgentNotesInRetrieval, setIncludeAgentNotesInRetrieval] = useState(true);
  const [agentWritePathPrefixesInput, setAgentWritePathPrefixesInput] = useState('agent-notes');
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
      .getSettings(selectedSlug)
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setName(loaded.name);
          setApprovalPolicy(readApprovalPolicy(loaded.settings));
          setIncludeAgentNotesInRetrieval(readIncludeAgentNotesInRetrieval(loaded.settings));
          setAgentWritePathPrefixesInput(
            formatAgentWritePathPrefixesInput(readWorkspaceAgentWritePathPrefixes(loaded.settings)),
          );
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
  }, [selectedSlug]);

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const updated = await kbClient.updateSettings(selectedSlug, {
        name: name.trim(),
        settings: {
          mutationApprovalPolicy: approvalPolicy,
          includeAgentNotesInRetrieval,
          agentWritePathPrefixes: parseAgentWritePathPrefixesInput(agentWritePathPrefixesInput),
        },
      });
      setSettings(updated);
      setName(updated.name);
      setApprovalPolicy(readApprovalPolicy(updated.settings));
      setIncludeAgentNotesInRetrieval(readIncludeAgentNotesInRetrieval(updated.settings));
      setAgentWritePathPrefixesInput(
        formatAgentWritePathPrefixesInput(readWorkspaceAgentWritePathPrefixes(updated.settings)),
      );
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
      <p>Editable workspace policies for agent writes and retrieval.</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading workspace settings…</p> : null}
      {!loading && !settings ? (
        <EmptyState title="Settings unavailable" hint="Check API connectivity and try again." />
      ) : null}
      {!loading && settings ? (
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
          <fieldset>
            <legend>Agent notes in search and Ask</legend>
            <p className="evukb-form-hint">
              When enabled, files under <code>agent-notes/</code> can appear in hybrid search and
              Ask citations. Disable to keep agent-authored notes out of retrieval for this
              workspace (corpora can override).
            </p>
            <div className="evukb-checkbox">
              <Switch
                aria-label="Include agent-notes in search and Ask"
                checked={includeAgentNotesInRetrieval}
                onCheckedChange={setIncludeAgentNotesInRetrieval}
              />
              <span>Include agent-notes/ in search and Ask</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Agent write path prefixes</legend>
            <p className="evukb-form-hint">
              Relative path prefixes where agent write tools may create or update files. One prefix
              per line; default is <code>agent-notes</code>. Corpus and credential settings can
              narrow this list further.
            </p>
            <label>
              Allowed prefixes
              <textarea
                onChange={(event) => setAgentWritePathPrefixesInput(event.target.value)}
                rows={4}
                value={agentWritePathPrefixesInput}
              />
            </label>
          </fieldset>
          <Button disabled={submitting} type="submit" variant="primary">
            {submitting ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
