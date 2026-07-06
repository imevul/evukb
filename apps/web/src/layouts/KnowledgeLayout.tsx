import type { KnowledgeCorpus } from '@evu/kb-sdk';
import {
  AppModal,
  Button,
  CorpusIndexEventProvider,
  DetailTabs,
  Field,
  formatFileTreeBytes,
  Input,
  Label,
  PageTitle,
  StatusPill,
} from '@evu/kb-ui';
import { ArrowLeft, Pencil } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appRoutes } from '../config.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

const renameCorpusFormId = 'rename-corpus-form';

export function KnowledgeLayout() {
  const { selectedSlug } = useWorkspace();
  const { corpusId } = useParams<{ corpusId: string }>();
  const [corpus, setCorpus] = useState<KnowledgeCorpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const corpusTabs = useMemo(() => {
    if (!corpusId) {
      return [];
    }
    return [
      { label: 'Overview', to: appRoutes.corpusOverview(corpusId), end: true },
      { label: 'Files', to: appRoutes.corpusFiles(corpusId), end: true },
      { label: 'Search', to: appRoutes.corpusSearch(corpusId), end: true },
      { label: 'Links', to: appRoutes.corpusLinks(corpusId), end: true },
      { label: 'Graph', to: appRoutes.corpusGraph(corpusId), end: true },
      { label: 'Ask', to: appRoutes.corpusAsk(corpusId), end: true },
    ];
  }, [corpusId]);

  useEffect(() => {
    if (!corpusId) {
      setCorpus(null);
      return;
    }

    let cancelled = false;
    void kbClient
      .getCorpus(selectedSlug, corpusId)
      .then((loaded) => {
        if (!cancelled) {
          setCorpus(loaded);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setCorpus(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load corpus.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [corpusId, selectedSlug]);

  function openRenameModal(): void {
    if (!corpus) {
      return;
    }
    setRenameName(corpus.name);
    setRenameError(null);
    setRenameOpen(true);
  }

  function closeRenameModal(): void {
    setRenameOpen(false);
    setRenameError(null);
  }

  async function handleRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!corpusId || !renameName.trim()) {
      return;
    }

    setRenameSaving(true);
    setRenameError(null);
    try {
      const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
        name: renameName.trim(),
      });
      setCorpus(updated);
      setRenameOpen(false);
      setError(null);
    } catch (saveError: unknown) {
      setRenameError(saveError instanceof Error ? saveError.message : 'Failed to rename corpus.');
    } finally {
      setRenameSaving(false);
    }
  }

  if (!corpusId) {
    return <Outlet />;
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            aria-label="Back to Knowledge"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            to={appRoutes.knowledgeList}
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </Link>
          <PageTitle>{corpus?.name ?? 'Loading corpus…'}</PageTitle>
          {corpus ? (
            <Button
              aria-label="Rename corpus"
              disabled={renameSaving}
              onClick={openRenameModal}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <span
          className="evukb-muted max-w-[min(24rem,40vw)] truncate font-mono text-xs"
          title={corpusId}
        >
          {corpusId}
        </span>
        <div aria-hidden className="min-w-0" />
      </div>
      <DetailTabs aria-label="Corpus sections" items={corpusTabs} />
      {corpus ? (
        <p className="evukb-muted">
          <StatusPill tone="neutral">{corpus.fileCount} files</StatusPill>{' '}
          <StatusPill tone="neutral">{corpus.chunkCount} chunks</StatusPill>{' '}
          <StatusPill tone="neutral">{formatFileTreeBytes(corpus.totalBytes)}</StatusPill>
        </p>
      ) : null}
      {error ? <p className="evukb-error">{error}</p> : null}
      <CorpusIndexEventProvider client={kbClient} corpusId={corpusId} workspaceId={selectedSlug}>
        <Outlet />
      </CorpusIndexEventProvider>
      <AppModal
        footer={
          <>
            <Button
              disabled={renameSaving}
              onClick={closeRenameModal}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={renameSaving}
              form={renameCorpusFormId}
              type="submit"
              variant="primary"
            >
              {renameSaving ? 'Saving…' : 'Save name'}
            </Button>
          </>
        }
        onClose={closeRenameModal}
        open={renameOpen}
        size="sm"
        title="Rename corpus"
      >
        {renameError ? <p className="evukb-error">{renameError}</p> : null}
        <form
          className="evukb-form"
          id={renameCorpusFormId}
          onSubmit={(event) => void handleRename(event)}
        >
          <Field>
            <Label htmlFor="rename-corpus-name">Name</Label>
            <Input
              disabled={renameSaving}
              id="rename-corpus-name"
              onChange={(event) => setRenameName(event.target.value)}
              required
              value={renameName}
            />
          </Field>
        </form>
      </AppModal>
    </>
  );
}
