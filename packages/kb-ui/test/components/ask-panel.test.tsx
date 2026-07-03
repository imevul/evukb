// @vitest-environment jsdom

import './setup.js';

import type { AskResponse } from '@evu/kb-sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AskPanel, type AskPanelProps } from '../../src/ask/AskPanel.js';
import { DisplayPreferencesProvider } from '../../src/display/DisplayPreferencesProvider.js';
import { emptySearchFilterDraft } from '../../src/search/search-filters.js';

const strategies = [
  { id: 'hybrid_default_v1', label: 'Hybrid default', version: '1' },
  { id: 'semantic_only', label: 'Semantic only', version: '1' },
];

function makeProps(overrides: Partial<AskPanelProps> = {}): AskPanelProps {
  return {
    question: '',
    onQuestionChange: vi.fn(),
    responseMode: 'concise',
    onResponseModeChange: vi.fn(),
    filterDraft: emptySearchFilterDraft(),
    onFilterDraftChange: vi.fn(),
    rankingStrategyId: '',
    onRankingStrategyIdChange: vi.fn(),
    strategies,
    embeddingConfigured: true,
    loading: false,
    onSubmit: vi.fn(),
    response: null,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    answer: 'EvuKB stores markdown files in corpora.',
    citations: [
      {
        citationId: 'cite-1',
        corpusId: 'corpus-1',
        nodeId: 'node-1',
        chunkId: 'chunk-1',
        filePath: 'notes/alpha.md',
        headingPath: ['Intro', 'Storage'],
        sourceType: 'chunk',
      },
    ],
    usedChunks: [],
    warnings: [],
    model: 'gpt-test',
    retrievalTrace: {
      query: 'How does EvuKB store files?',
      strategyId: 'hybrid_default_v1',
      candidateCount: 8,
      selectedCount: 2,
    },
    ...overrides,
  };
}

function QuestionHarness({ onSubmit }: { onSubmit: () => void }): ReactElement {
  const [question, setQuestion] = useState('');
  return (
    <AskPanel {...makeProps({ onSubmit })} onQuestionChange={setQuestion} question={question} />
  );
}

function renderAskPanel(ui: ReactElement): ReturnType<typeof render> {
  return render(<DisplayPreferencesProvider>{ui}</DisplayPreferencesProvider>);
}

describe('AskPanel', () => {
  it('shows the initial empty state with a corpus-scoped hint', () => {
    renderAskPanel(<AskPanel {...makeProps()} />);

    expect(screen.getByText('Ask a question')).toBeTruthy();
    expect(screen.getByText('Answers cite retrieved chunks from this corpus.')).toBeTruthy();
  });

  it('submits after the user types a question', () => {
    const onSubmit = vi.fn();
    renderAskPanel(<QuestionHarness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'How does EvuKB store files?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables the submit button while asking', () => {
    renderAskPanel(<AskPanel {...makeProps({ loading: true })} />);

    const button = screen.getByRole('button', { name: 'Asking…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('renders a streaming answer placeholder, then the final answer with citations', () => {
    const streaming = makeResponse({ answer: '', citations: [], warnings: [] });
    const { rerender } = renderAskPanel(
      <AskPanel {...makeProps({ loading: true, response: streaming })} />,
    );

    expect(screen.getByText('Generating answer…')).toBeTruthy();

    rerender(
      <DisplayPreferencesProvider>
        <AskPanel
          {...makeProps({
            loading: false,
            response: makeResponse({ warnings: ['Embedding provider not configured'] }),
          })}
        />
      </DisplayPreferencesProvider>,
    );

    expect(screen.getByText('EvuKB stores markdown files in corpora.')).toBeTruthy();
    expect(screen.getByText('notes/alpha.md')).toBeTruthy();
    expect(screen.getByText(/Intro > Storage/)).toBeTruthy();
    expect(screen.getByText('Embedding provider not configured')).toBeTruthy();
    expect(screen.queryByText('Generating answer…')).toBeNull();
  });

  it('renders citations through a custom file link renderer', () => {
    renderAskPanel(
      <AskPanel
        {...makeProps({
          response: makeResponse(),
          renderCitationFileLink: (citation) => (
            <a href={`/files/${citation.filePath}`}>{`Open ${citation.filePath}`}</a>
          ),
        })}
      />,
    );

    const link = screen.getByRole('link', { name: 'Open notes/alpha.md' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/files/notes/alpha.md');
  });

  it('shows an error message', () => {
    renderAskPanel(<AskPanel {...makeProps({ error: 'Ask failed: provider unavailable.' })} />);

    expect(screen.getByText('Ask failed: provider unavailable.')).toBeTruthy();
  });

  it('propagates response mode and ranking strategy changes', () => {
    const onResponseModeChange = vi.fn();
    const onRankingStrategyIdChange = vi.fn();
    renderAskPanel(
      <AskPanel {...makeProps({ onResponseModeChange, onRankingStrategyIdChange })} />,
    );

    fireEvent.change(screen.getByLabelText('Response mode'), { target: { value: 'detailed' } });
    expect(onResponseModeChange).toHaveBeenCalledWith('detailed');

    fireEvent.change(screen.getByLabelText('Ranking strategy'), {
      target: { value: 'semantic_only' },
    });
    expect(onRankingStrategyIdChange).toHaveBeenCalledWith('semantic_only');
  });

  it('renders the workspace corpus multi-select and toggles corpora', () => {
    const onToggle = vi.fn();
    const setCorpusIds = vi.fn();
    renderAskPanel(
      <AskPanel
        {...makeProps({
          layout: 'workspace',
          workspaceCorpora: {
            availableCorpora: [
              {
                id: 'corpus-a',
                name: 'Docs',
                fileCount: 3,
                totalBytes: 2048,
                updatedAt: '2026-01-05T10:00:00.000Z',
              },
              {
                id: 'corpus-b',
                name: 'Runbooks',
                fileCount: 5,
                totalBytes: 4096,
                updatedAt: '2026-01-06T10:00:00.000Z',
              },
            ],
            corpusIds: ['corpus-a'],
            onToggle,
            setCorpusIds,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Runbooks' }));
    expect(onToggle).toHaveBeenCalledWith('corpus-b');

    fireEvent.click(screen.getByRole('switch', { name: 'Select all corpora' }));
    expect(setCorpusIds).toHaveBeenCalledWith(['corpus-a', 'corpus-b']);
  });
});
