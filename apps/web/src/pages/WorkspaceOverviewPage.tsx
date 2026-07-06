import type { SettingsResponse } from '@evu/kb-sdk';
import { EmptyState, StatusPill } from '@evu/kb-ui';
import { useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';
import { buildBootHintCards } from './workspace-settings-shared.js';

export function WorkspaceOverviewPage() {
  const { selectedSlug } = useWorkspace();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .getSettings(selectedSlug)
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace.');
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

  return (
    <section aria-label="Workspace overview" className="evukb-panel">
      <p>Workspace identity and environment-sourced boot configuration.</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {loading ? <p className="evukb-muted">Loading workspace overview…</p> : null}
      {!loading && !settings ? (
        <EmptyState title="Workspace unavailable" hint="Check API connectivity and try again." />
      ) : null}
      {!loading && settings ? (
        <>
          <dl className="evukb-settings-dl">
            <div>
              <dt>Display name</dt>
              <dd>{settings.name}</dd>
            </div>
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
