import type {
  AiProvidersView,
  RankingSettings,
  RankingStrategySummary,
  RankingStrategyUsageView,
  SettingsResponse,
} from '@evu/kb-sdk';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmModal,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@evu/kb-ui';
import { Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

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

function strategyRequiresEmbedding(strategy: RankingStrategySummary): boolean {
  return strategy.requiresEmbedding === true;
}

function strategyRequiresChat(strategy: RankingStrategySummary): boolean {
  return strategy.requiresChatProvider === true;
}

function strategyLabel(strategy: RankingStrategySummary): string {
  return strategy.label ?? strategy.id;
}

const referenceExampleRankingStrategies = [
  {
    id: 'boost_agent_notes_v1',
    label: 'Agent notes boost',
    description: 'Hybrid RRF with a default path boost for agent-notes/.',
  },
  {
    id: 'prefer_docs_prefix_v1',
    label: 'Docs prefix preference',
    description: 'Hybrid RRF with a custom rank() that boosts docs/ paths.',
  },
] as const;

function RankingPluginsPanel({
  onRefreshSettings,
  selectedSlug,
}: {
  onRefreshSettings: () => Promise<void>;
  selectedSlug: string;
}) {
  const [strategies, setStrategies] = useState<RankingStrategySummary[]>([]);
  const [usagePreview, setUsagePreview] = useState<RankingStrategyUsageView | null>(null);
  const [pendingUninstallId, setPendingUninstallId] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const [installingExampleId, setInstallingExampleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await kbClient.listRankingStrategies(selectedSlug);
      setStrategies(response.strategies);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load ranking plugins.');
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  async function beginUninstall(strategyId: string): Promise<void> {
    setMessage(null);
    setError(null);
    setUninstallError(null);
    try {
      const usage = await kbClient.getRankingStrategyUsage(selectedSlug, strategyId);
      setUsagePreview(usage);
      setPendingUninstallId(strategyId);
    } catch (previewError: unknown) {
      setError(
        previewError instanceof Error ? previewError.message : 'Failed to load plugin usage.',
      );
    }
  }

  function closeUninstallModal(): void {
    if (uninstalling) {
      return;
    }
    setPendingUninstallId(null);
    setUsagePreview(null);
    setUninstallError(null);
  }

  async function confirmUninstall(): Promise<void> {
    if (!pendingUninstallId) {
      return;
    }
    setUninstalling(true);
    setUninstallError(null);
    try {
      const result = await kbClient.unregisterRankingStrategy(selectedSlug, pendingUninstallId);
      setMessage(
        `Uninstalled ${result.strategyId}. Updated ${result.remediatedCorpusCount} corpus override(s).`,
      );
      setPendingUninstallId(null);
      setUsagePreview(null);
      await loadStrategies();
      await onRefreshSettings();
    } catch (uninstallFailure: unknown) {
      setUninstallError(
        uninstallFailure instanceof Error
          ? uninstallFailure.message
          : 'Failed to uninstall plugin.',
      );
    } finally {
      setUninstalling(false);
    }
  }

  async function installExample(exampleId: string): Promise<void> {
    setMessage(null);
    setError(null);
    setInstallingExampleId(exampleId);
    try {
      const result = await kbClient.registerRankingStrategyExample(selectedSlug, exampleId);
      setMessage(`Installed ${result.strategy.label ?? result.strategy.id}.`);
      await loadStrategies();
      await onRefreshSettings();
    } catch (installError: unknown) {
      setError(
        installError instanceof Error
          ? installError.message
          : 'Failed to install example strategy.',
      );
    } finally {
      setInstallingExampleId(null);
    }
  }

  const customStrategies = strategies.filter((strategy) => !strategy.builtin);
  const installedCustomIds = new Set(customStrategies.map((strategy) => strategy.id));
  const installableExamples = referenceExampleRankingStrategies.filter(
    (example) => !installedCustomIds.has(example.id),
  );
  const pendingUninstallStrategy = customStrategies.find(
    (strategy) => strategy.id === pendingUninstallId,
  );

  return (
    <section aria-label="Ranking plugins" className="evukb-panel mt-6">
      <h2 className="text-lg font-semibold">Ranking plugins</h2>
      <p className="evukb-muted">
        Custom strategies extend the built-in registry. Install reference examples below or register
        your own with <code>kb:admin</code> via API or boot-time registration.
      </p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading installed strategies…</p> : null}
      {!loading && customStrategies.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            hint="Install a reference example below or register a strategy via the operator API."
            title="No custom ranking strategies installed"
          />
        </div>
      ) : null}
      {!loading && customStrategies.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customStrategies.map((strategy) => (
                <TableRow key={strategy.id}>
                  <TableCell className="min-w-[12rem]">
                    <div className="min-w-0">
                      <p className="m-0 font-medium">{strategyLabel(strategy)}</p>
                      <p
                        className="m-0 truncate font-mono text-[11px] text-muted-foreground/80"
                        title={strategy.id}
                      >
                        {strategy.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    v{strategy.version}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => void beginUninstall(strategy.id)}
                        size="sm"
                        type="button"
                        variant="dangerOutline"
                      >
                        Uninstall
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {!loading && installableExamples.length > 0 ? (
        <Card className="mt-6 gap-0 border-dashed bg-muted/15 p-0 shadow-none">
          <CardHeader className="gap-2 border-b border-border px-5 py-4">
            <CardTitle className="text-base">Reference examples</CardTitle>
            <p className="m-0 text-sm text-muted-foreground">
              Shipped with EvuKB in <code>examples/custom-ranking-strategy/</code>. Requires plugin
              reload and <code>kb:admin</code>.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installableExamples.map((example) => (
                  <TableRow key={example.id}>
                    <TableCell className="min-w-[12rem] align-top">
                      <div className="min-w-0">
                        <p className="m-0 font-medium">{example.label}</p>
                        <p
                          className="m-0 truncate font-mono text-[11px] text-muted-foreground/80"
                          title={example.id}
                        >
                          {example.id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {example.description}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end">
                        <Button
                          disabled={installingExampleId !== null}
                          onClick={() => void installExample(example.id)}
                          size="sm"
                          type="button"
                          variant="primary"
                        >
                          {installingExampleId === example.id ? 'Installing…' : 'Install'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      <ConfirmModal
        confirmLabel="Uninstall"
        confirming={uninstalling}
        confirmingLabel="Uninstalling…"
        description="Affected corpora fall back to the workspace default. The workspace default resets to hybrid_default_v1 when it used this strategy."
        error={uninstallError}
        onClose={closeUninstallModal}
        onConfirm={() => void confirmUninstall()}
        open={pendingUninstallId !== null && usagePreview !== null}
        title={
          pendingUninstallStrategy
            ? `Uninstall “${strategyLabel(pendingUninstallStrategy)}”?`
            : 'Uninstall ranking strategy?'
        }
      >
        {usagePreview && usagePreview.corpora.length > 0 ? (
          <div className="space-y-2">
            <p className="m-0 text-sm">These corpora currently override this strategy:</p>
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
              {usagePreview.corpora.map((corpus) => (
                <li key={corpus.id}>
                  <span className="font-medium">{corpus.name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">{corpus.id}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            No corpora currently override this strategy.
          </p>
        )}
      </ConfirmModal>
    </section>
  );
}

export function RankingSettingsPage() {
  const { selectedSlug } = useWorkspace();
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

  async function reloadSettings(): Promise<void> {
    const [loaded, providers] = await Promise.all([
      kbClient.getSettings(selectedSlug),
      kbClient.getAiProviders(selectedSlug),
    ]);
    setSettings(loaded);
    setAiProviders(providers);
    setWorkspaceStrategyId(loaded.ranking.strategyId);
    setRanking(loaded.ranking.settings);
    setPathBoostRowsState(pathBoostRows(loaded.ranking.settings));
  }

  const embeddingConfigured =
    aiProviders?.embedding.configured && aiProviders.embedding.healthStatus === 'ok';
  const chatConfigured = aiProviders?.chat.configured && aiProviders.chat.healthStatus === 'ok';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([kbClient.getSettings(selectedSlug), kbClient.getAiProviders(selectedSlug)])
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
  }, [selectedSlug]);

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
      const updated = await kbClient.updateSettings(selectedSlug, {
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
    <>
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
                      (strategyRequiresEmbedding(strategy) && embeddingConfigured === false) ||
                      (strategyRequiresChat(strategy) && chatConfigured === false)
                    }
                    key={strategy.id}
                    value={strategy.id}
                  >
                    {strategyLabel(strategy)} (v{strategy.version})
                  </option>
                ))}
              </select>
            </label>
            {(() => {
              const selected = settings.ranking.availableStrategies.find(
                (strategy) => strategy.id === workspaceStrategyId,
              );
              return selected && strategyRequiresEmbedding(selected) && !embeddingConfigured ? (
                <p className="evukb-muted">
                  semantic_only requires a configured embedding provider with healthy status.
                </p>
              ) : null;
            })()}
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
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path prefix</TableHead>
                      <TableHead className="w-32">Multiplier</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pathBoostRowsState.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            aria-label="Path prefix"
                            onChange={(event) =>
                              updatePathBoostRow(row.id, 'prefix', event.target.value)
                            }
                            placeholder="/docs"
                            type="text"
                            value={row.prefix}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label="Multiplier"
                            className="w-24"
                            inputMode="decimal"
                            onChange={(event) =>
                              updatePathBoostRow(row.id, 'multiplier', event.target.value)
                            }
                            placeholder="2"
                            type="text"
                            value={row.multiplier}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              aria-label="Remove path boost"
                              onClick={() => removePathBoostRow(row.id)}
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
              </div>
              <Button className="mt-2" onClick={addPathBoostRow} type="button" variant="quiet">
                Add path boost
              </Button>
            </fieldset>
            <Button disabled={submitting} type="submit" variant="primary">
              {submitting ? 'Saving…' : 'Save ranking preferences'}
            </Button>
          </form>
        ) : null}
      </section>
      <RankingPluginsPanel onRefreshSettings={reloadSettings} selectedSlug={selectedSlug} />
    </>
  );
}
