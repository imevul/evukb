import type { AiProviderOverride, AiProvidersView, EmbeddingChunkingStrategy } from '@evu/kb-sdk';
import { Alert, Button, EmptyState, StatusBadge, Switch } from '@evu/kb-ui';
import { type FormEvent, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

type ProviderDraft = {
  overrideEnabled: boolean;
  model: string;
  baseUrl: string;
};

type EmbeddingDraft = ProviderDraft & {
  chunkingStrategy: EmbeddingChunkingStrategy;
  maxChunkTokens: string;
};

const chunkingStrategyOptions: Array<{ value: EmbeddingChunkingStrategy; label: string }> = [
  { value: 'headings', label: 'Headings only' },
  { value: 'headings_subsplit', label: 'Headings + natural splits' },
  {
    value: 'headings_subsplit_capped',
    label: 'Headings + natural splits (size limit)',
  },
];

function readProviderDraft(provider: AiProvidersView['embedding']): ProviderDraft {
  return {
    overrideEnabled: provider.source === 'database',
    model: provider.model,
    baseUrl: provider.baseUrl ?? '',
  };
}

function readEmbeddingDraft(provider: AiProvidersView['embedding']): EmbeddingDraft {
  return {
    ...readProviderDraft(provider),
    chunkingStrategy: provider.chunkingStrategy?.value ?? 'headings',
    maxChunkTokens: String(provider.maxChunkTokens?.value ?? 512),
  };
}

function formatSettingSource(source: string | undefined): string {
  if (source === 'database') {
    return 'workspace';
  }
  if (source === 'env') {
    return 'environment';
  }
  return 'default';
}

export function AiProvidersPage() {
  const [providers, setProviders] = useState<AiProvidersView | null>(null);
  const [embeddingDraft, setEmbeddingDraft] = useState<EmbeddingDraft>({
    overrideEnabled: false,
    model: '',
    baseUrl: '',
    chunkingStrategy: 'headings',
    maxChunkTokens: '512',
  });
  const [chatDraft, setChatDraft] = useState<ProviderDraft>({
    overrideEnabled: false,
    model: '',
    baseUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .getAiProviders(appConfig.workspaceId)
      .then((loaded) => {
        if (!cancelled) {
          setProviders(loaded);
          setEmbeddingDraft(readEmbeddingDraft(loaded.embedding));
          setChatDraft(readProviderDraft(loaded.chat));
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load AI providers.');
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
      const patch = {
        embedding: buildEmbeddingPatch(embeddingDraft),
        chat: buildProviderOverride(chatDraft),
      };
      const updated = await kbClient.updateAiProviders(appConfig.workspaceId, patch);
      setProviders(updated);
      setEmbeddingDraft(readEmbeddingDraft(updated.embedding));
      setChatDraft(readProviderDraft(updated.chat));
      setMessage('AI provider overrides saved.');
      setError(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save AI providers.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="AI providers" className="evukb-panel">
      <p>
        Effective embedding and chat configuration. Model and base URL can be overridden per
        workspace. Chunking controls how markdown is split before embedding.
      </p>
      <Alert title="API keys are configured on the API server." variant="info">
        <p>
          Set <code>EVUKB_EMBEDDING_API_KEY</code> for semantic indexing/search and{' '}
          <code>EVUKB_CHAT_API_KEY</code> for Ask/chat in the repository root <code>.env</code>{' '}
          (copy from <code>.env.example</code>). <code>EVUKB_EMBEDDING_BASE_URL</code> and{' '}
          <code>EVUKB_CHAT_BASE_URL</code> are optional overrides for OpenAI-compatible endpoints.
          Chunking can also be set via <code>EVUKB_CHUNKING_STRATEGY</code> and{' '}
          <code>EVUKB_CHUNK_MAX_TOKENS</code>.
        </p>
      </Alert>
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading AI providers…</p> : null}
      {!loading && !providers ? (
        <EmptyState title="Providers unavailable" hint="Check API connectivity and try again." />
      ) : null}
      {!loading && providers ? (
        <>
          <div className="evukb-stat-grid grid-cols-1 md:grid-cols-2">
            {(['embedding', 'chat'] as const).map((kind) => {
              const provider = providers[kind];
              return (
                <div key={kind} className="evukb-stat-card">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{kind === 'embedding' ? 'Embedding' : 'Chat'}</strong>
                    <StatusBadge status={provider.healthStatus} />
                  </div>
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Model</dt>
                    <dd className="m-0 [overflow-wrap:anywhere]">{provider.model}</dd>
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="m-0 [overflow-wrap:anywhere]">{provider.providerId}</dd>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="m-0 [overflow-wrap:anywhere]">{provider.source ?? 'env'}</dd>
                    {provider.baseUrl ? (
                      <>
                        <dt className="text-muted-foreground">Base URL</dt>
                        <dd className="m-0 [overflow-wrap:anywhere]">{provider.baseUrl}</dd>
                      </>
                    ) : null}
                    {kind === 'embedding' && provider.chunkingStrategy ? (
                      <>
                        <dt className="text-muted-foreground">Chunking</dt>
                        <dd className="m-0 [overflow-wrap:anywhere]">
                          {provider.chunkingStrategy.value} (
                          {formatSettingSource(provider.chunkingStrategy.source)})
                        </dd>
                        <dt className="text-muted-foreground">Max chunk size</dt>
                        <dd className="m-0 [overflow-wrap:anywhere]">
                          {provider.maxChunkTokens?.value ?? 512} tokens (
                          {formatSettingSource(provider.maxChunkTokens?.source)})
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {provider.healthMessage ? (
                    <p className="evukb-muted">{provider.healthMessage}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <form className="evukb-form" onSubmit={(event) => void handleSave(event)}>
            <fieldset>
              <legend>Workspace overrides</legend>
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Embedding</h2>
                <div className="evukb-checkbox">
                  <Switch
                    aria-label="Enable embedding workspace override"
                    checked={embeddingDraft.overrideEnabled}
                    onCheckedChange={(checked) =>
                      setEmbeddingDraft((current) => ({
                        ...current,
                        overrideEnabled: checked,
                      }))
                    }
                  />
                  <span>Enable embedding workspace override</span>
                </div>
                <label>
                  Model
                  <input
                    disabled={!embeddingDraft.overrideEnabled}
                    type="text"
                    value={embeddingDraft.model}
                    onChange={(event) =>
                      setEmbeddingDraft((current) => ({ ...current, model: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Base URL
                  <input
                    disabled={!embeddingDraft.overrideEnabled}
                    type="url"
                    value={embeddingDraft.baseUrl}
                    onChange={(event) =>
                      setEmbeddingDraft((current) => ({ ...current, baseUrl: event.target.value }))
                    }
                  />
                </label>
                <div className="evukb-form-grid md:grid-cols-2">
                  <label>
                    Chunking strategy
                    <select
                      value={embeddingDraft.chunkingStrategy}
                      onChange={(event) =>
                        setEmbeddingDraft((current) => ({
                          ...current,
                          chunkingStrategy: event.target.value as EmbeddingChunkingStrategy,
                        }))
                      }
                    >
                      {chunkingStrategyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Max chunk size (tokens)
                    <input
                      disabled={embeddingDraft.chunkingStrategy !== 'headings_subsplit_capped'}
                      min={64}
                      max={8192}
                      type="number"
                      value={embeddingDraft.maxChunkTokens}
                      onChange={(event) =>
                        setEmbeddingDraft((current) => ({
                          ...current,
                          maxChunkTokens: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="evukb-muted text-sm">
                  Max chunk size is only used with the size-limit strategy. Set below your embedding
                  server&apos;s -ub batch size.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Chat</h2>
                <div className="evukb-checkbox">
                  <Switch
                    aria-label="Enable chat workspace override"
                    checked={chatDraft.overrideEnabled}
                    onCheckedChange={(checked) =>
                      setChatDraft((current) => ({
                        ...current,
                        overrideEnabled: checked,
                      }))
                    }
                  />
                  <span>Enable chat workspace override</span>
                </div>
                <label>
                  Model
                  <input
                    disabled={!chatDraft.overrideEnabled}
                    type="text"
                    value={chatDraft.model}
                    onChange={(event) =>
                      setChatDraft((current) => ({ ...current, model: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Base URL
                  <input
                    disabled={!chatDraft.overrideEnabled}
                    type="url"
                    value={chatDraft.baseUrl}
                    onChange={(event) =>
                      setChatDraft((current) => ({ ...current, baseUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
            </fieldset>
            <Button disabled={submitting} type="submit" variant="primary">
              {submitting ? 'Saving…' : 'Save provider overrides'}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}

function buildProviderOverride(draft: ProviderDraft): AiProviderOverride | null {
  if (!draft.overrideEnabled) {
    return null;
  }
  const override: AiProviderOverride = {};
  const model = draft.model.trim();
  const baseUrl = draft.baseUrl.trim();
  if (model) {
    override.model = model;
  }
  if (baseUrl) {
    override.baseUrl = baseUrl;
  }
  return Object.keys(override).length > 0 ? override : null;
}

function buildEmbeddingPatch(draft: EmbeddingDraft): AiProviderOverride {
  const override: AiProviderOverride = {
    chunkingStrategy: draft.chunkingStrategy,
  };

  const providerOverride = buildProviderOverride(draft);
  if (providerOverride?.model) {
    override.model = providerOverride.model;
  }
  if (providerOverride?.baseUrl) {
    override.baseUrl = providerOverride.baseUrl;
  }

  if (draft.chunkingStrategy === 'headings_subsplit_capped') {
    const parsed = Number.parseInt(draft.maxChunkTokens, 10);
    if (Number.isInteger(parsed)) {
      override.maxChunkTokens = parsed;
    }
  }

  return override;
}
