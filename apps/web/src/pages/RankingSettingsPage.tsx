import type { AiProvidersView, RankingSettings, SettingsResponse } from '@evu/kb-sdk';
import { Alert, Button, EmptyState } from '@evu/kb-ui';
import { type FormEvent, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

const defaultRankingValues = {
  keywordWeight: 1,
  semanticWeight: 1,
  recencyBoost: 0,
  okfCitationBoost: 0,
  exactTitleBoost: 0,
  exactPathBoost: 0,
} as const satisfies Record<
  | 'keywordWeight'
  | 'semanticWeight'
  | 'recencyBoost'
  | 'okfCitationBoost'
  | 'exactTitleBoost'
  | 'exactPathBoost',
  number
>;

const rankingFields: Array<{
  key: keyof typeof defaultRankingValues;
  label: string;
  hint: string;
}> = [
  {
    key: 'keywordWeight',
    label: 'Keyword weight',
    hint: 'Multiplier on the keyword RRF component.',
  },
  {
    key: 'semanticWeight',
    label: 'Semantic weight',
    hint: 'Multiplier on the semantic RRF component.',
  },
  {
    key: 'recencyBoost',
    label: 'Recency boost',
    hint: 'Extra score for recently indexed docs; 0 disables.',
  },
  {
    key: 'okfCitationBoost',
    label: 'OKF citation boost',
    hint: 'Extra score for OKF citation sections; 0 disables.',
  },
  {
    key: 'exactTitleBoost',
    label: 'Exact title boost',
    hint: 'Extra score when the query matches the node title; 0 disables.',
  },
  {
    key: 'exactPathBoost',
    label: 'Exact path boost',
    hint: 'Reserved for future path matching; 0 disables today.',
  },
];

type PathBoostRow = {
  id: string;
  prefix: string;
  multiplier: string;
};

function pathBoostRows(settings: RankingSettings): PathBoostRow[] {
  const entries = Object.entries(settings.pathBoosts ?? {});
  if (entries.length === 0) {
    return [{ id: '0', prefix: '', multiplier: '' }];
  }
  return entries.map(([prefix, multiplier], index) => ({
    id: String(index),
    prefix,
    multiplier: String(multiplier),
  }));
}

function buildPathBoosts(rows: PathBoostRow[]): Record<string, number> | undefined {
  const boosts: Record<string, number> = {};
  for (const row of rows) {
    const prefix = row.prefix.trim();
    const multiplier = Number.parseFloat(row.multiplier.trim());
    if (prefix && Number.isFinite(multiplier)) {
      boosts[prefix] = multiplier;
    }
  }
  return Object.keys(boosts).length > 0 ? boosts : undefined;
}

function strategyRequiresEmbedding(strategyId: string): boolean {
  return strategyId === 'semantic_only';
}

function strategyRequiresChat(strategyId: string): boolean {
  return strategyId === 'reranker_llm';
}

export function RankingSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [aiProviders, setAiProviders] = useState<AiProvidersView | null>(null);
  const [workspaceStrategyId, setWorkspaceStrategyId] = useState('hybrid_default_v1');
  const [ranking, setRanking] = useState<RankingSettings>({});
  const [pathBoostRowsState, setPathBoostRowsState] = useState<PathBoostRow[]>([
    { id: '0', prefix: '', multiplier: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const embeddingConfigured =
    aiProviders?.embedding.configured && aiProviders.embedding.healthStatus === 'ok';
  const chatConfigured = aiProviders?.chat.configured && aiProviders.chat.healthStatus === 'ok';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      kbClient.getSettings(appConfig.workspaceId),
      kbClient.getAiProviders(appConfig.workspaceId),
    ])
      .then(([loaded, providers]) => {
        if (!cancelled) {
          setSettings(loaded);
          setAiProviders(providers);
          setWorkspaceStrategyId(loaded.ranking.strategyId);
          setRanking(loaded.ranking.settings);
          setPathBoostRowsState(pathBoostRows(loaded.ranking.settings));
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load ranking settings.',
          );
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
    setSubmitting(true);
    setMessage(null);
    try {
      const pathBoosts = buildPathBoosts(pathBoostRowsState);
      const nextRanking: RankingSettings = {
        ...ranking,
        ...(pathBoosts ? { pathBoosts } : {}),
      };
      const updated = await kbClient.updateSettings(appConfig.workspaceId, {
        settings: {
          rankingSettings: nextRanking,
          rankingStrategyId: workspaceStrategyId,
        },
      });
      setSettings(updated);
      setWorkspaceStrategyId(updated.ranking.strategyId);
      setRanking(updated.ranking.settings);
      setPathBoostRowsState(pathBoostRows(updated.ranking.settings));
      setMessage('Ranking preferences saved.');
      setError(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save ranking settings.');
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(key: keyof RankingSettings, raw: string): void {
    const value = raw.trim() === '' ? undefined : Number.parseFloat(raw);
    setRanking((current) => ({
      ...current,
      [key]: value !== undefined && Number.isFinite(value) ? value : undefined,
    }));
  }

  function addPathBoostRow(): void {
    setPathBoostRowsState((current) => [
      ...current,
      { id: String(Date.now()), prefix: '', multiplier: '' },
    ]);
  }

  function updatePathBoostRow(id: string, field: 'prefix' | 'multiplier', value: string): void {
    setPathBoostRowsState((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function removePathBoostRow(id: string): void {
    setPathBoostRowsState((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [{ id: String(Date.now()), prefix: '', multiplier: '' }];
    });
  }

  const futureStrategyIds: string[] = [];

  return (
    <section aria-label="Ranking settings" className="evukb-panel">
      {settings ? (
        <>
          <p className="evukb-muted">
            Workspace default strategy: {settings.ranking.strategyId} · Source:{' '}
            {settings.ranking.source}. {settings.ranking.note}
          </p>
          <p className="evukb-muted">
            Active strategies:{' '}
            {settings.ranking.availableStrategies.map((strategy) => strategy.id).join(', ')}.
            {futureStrategyIds.length > 0 ? ` Planned: ${futureStrategyIds.join(', ')}.` : ''}
          </p>
        </>
      ) : null}
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading ranking settings…</p> : null}
      {!loading && !settings ? (
        <EmptyState
          title="Ranking settings unavailable"
          hint="Check API connectivity and try again."
        />
      ) : null}
      {!loading && settings ? (
        <form className="evukb-form" onSubmit={(event) => void handleSave(event)}>
          <label>
            Workspace default ranking strategy
            <select
              onChange={(event) => setWorkspaceStrategyId(event.target.value)}
              value={workspaceStrategyId}
            >
              {settings.ranking.availableStrategies.map((strategy) => (
                <option
                  disabled={
                    (strategyRequiresEmbedding(strategy.id) && embeddingConfigured === false) ||
                    (strategyRequiresChat(strategy.id) && chatConfigured === false)
                  }
                  key={strategy.id}
                  value={strategy.id}
                >
                  {strategy.id} (v{strategy.version})
                </option>
              ))}
            </select>
          </label>
          {strategyRequiresEmbedding(workspaceStrategyId) && !embeddingConfigured ? (
            <p className="evukb-muted">
              semantic_only requires a configured embedding provider with healthy status.
            </p>
          ) : null}
          <fieldset>
            <legend>Hybrid score weights</legend>
            <p className="evukb-form-hint">
              Optional numeric multipliers and boosts for <code>hybrid_default_v1</code>. Leave a
              field blank to use the default shown in its placeholder. Only values you change are
              saved to the workspace.
            </p>
            <div className="evukb-form-grid">
              {rankingFields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    min={0}
                    placeholder={String(defaultRankingValues[field.key])}
                    step="any"
                    type="number"
                    value={typeof ranking[field.key] === 'number' ? ranking[field.key] : ''}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  />
                  <span className="evukb-form-hint">{field.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Path boosts</legend>
            <p className="evukb-muted">
              Multiply search scores for documents under a path prefix (e.g. /docs → 2).
            </p>
            {pathBoostRowsState.map((row) => (
              <div key={row.id} className="evukb-form-row">
                <label>
                  Path prefix
                  <input
                    type="text"
                    value={row.prefix}
                    onChange={(event) => updatePathBoostRow(row.id, 'prefix', event.target.value)}
                    placeholder="/docs"
                  />
                </label>
                <label>
                  Multiplier
                  <input
                    inputMode="decimal"
                    type="text"
                    value={row.multiplier}
                    onChange={(event) =>
                      updatePathBoostRow(row.id, 'multiplier', event.target.value)
                    }
                    placeholder="2"
                  />
                </label>
                <Button onClick={() => removePathBoostRow(row.id)} type="button" variant="danger">
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addPathBoostRow} type="button" variant="quiet">
              Add path boost
            </Button>
          </fieldset>
          <Button disabled={submitting} type="submit" variant="primary">
            {submitting ? 'Saving…' : 'Save ranking preferences'}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
