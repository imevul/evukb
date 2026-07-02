// @vitest-environment jsdom

import './setup.js';

import { ColorSchemeProvider, FileEditorModal } from '@evu/kb-ui';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { AppLayout } from '../../src/layouts/AppLayout.js';
import { ApiKeysPage } from '../../src/pages/ApiKeysPage.js';
import { CorpusGraphPage } from '../../src/pages/CorpusGraphPage.js';
import { CorpusSearchPage } from '../../src/pages/CorpusSearchPage.js';
import { KnowledgeListPage } from '../../src/pages/KnowledgeListPage.js';

const { kbClientMock } = vi.hoisted(() => ({
  kbClientMock: {
    listCorpora: vi.fn().mockResolvedValue([]),
    listSecrets: vi.fn().mockResolvedValue([]),
    listApiKeys: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({
      ranking: {
        availableStrategies: [{ id: 'hybrid_default_v1', label: 'Hybrid default', version: '1' }],
      },
    }),
    getAiProviders: vi.fn().mockResolvedValue({
      embedding: { configured: true, healthStatus: 'ok' },
      chat: { configured: false, healthStatus: 'unknown' },
    }),
    search: vi.fn().mockResolvedValue([]),
    getLinkGraph: vi.fn().mockResolvedValue({
      nodes: [
        {
          nodeId: 'node-a',
          filePath: 'notes/alpha.md',
          label: 'Alpha',
          hasValidationIssues: false,
        },
      ],
      edges: [],
      truncated: false,
    }),
    getGraphNeighborhood: vi.fn().mockResolvedValue({
      centerNodeId: 'node-a',
      nodes: [
        {
          nodeId: 'node-a',
          filePath: 'notes/alpha.md',
          label: 'Alpha',
          hasValidationIssues: false,
        },
        {
          nodeId: 'node-b',
          filePath: 'notes/beta.md',
          label: 'Beta',
          hasValidationIssues: false,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-a',
          toNodeId: 'node-b',
          resolved: true,
          targetPath: null,
          raw: '[[Beta]]',
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-b',
          toNodeId: null,
          resolved: false,
          targetPath: 'missing.md',
          raw: '[[Missing]]',
        },
      ],
      truncated: false,
    }),
  },
}));

vi.mock('../../src/api/client.js', () => ({
  kbClient: kbClientMock,
}));

function renderWithProviders(ui: ReactElement, initialEntry = '/'): ReturnType<typeof render> {
  return render(
    <ColorSchemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </ColorSchemeProvider>,
  );
}

async function expectAccessible(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

describe('a11y baseline', () => {
  it('app shell with knowledge list has no axe violations', async () => {
    const { container } = renderWithProviders(
      <Routes>
        <Route element={<AppLayout />} path="/">
          <Route element={<KnowledgeListPage />} path="knowledge" />
        </Route>
      </Routes>,
      '/knowledge',
    );

    await expectAccessible(container);
  });

  it('corpus search form has no axe violations', async () => {
    const { container } = renderWithProviders(
      <Routes>
        <Route element={<CorpusSearchPage />} path="/knowledge/:corpusId/search" />
      </Routes>,
      '/knowledge/demo/search',
    );

    await expectAccessible(container);
  });

  it('corpus graph page has no axe violations', async () => {
    const { container, findByRole } = renderWithProviders(
      <Routes>
        <Route element={<CorpusGraphPage />} path="/knowledge/:corpusId/graph" />
      </Routes>,
      '/knowledge/demo/graph',
    );

    await findByRole('group', { name: 'Link graph neighborhood' });

    await expectAccessible(container);
  });

  it('file editor modal shell has no axe violations', async () => {
    const { container } = renderWithProviders(
      <FileEditorModal
        fileName="notes/example.md"
        onClose={() => {}}
        onTextChange={() => {}}
        open
        textValue={'---\ntitle: Example\n---\n\n# Heading\n'}
      />,
    );

    await expectAccessible(container);
  });

  it('api keys settings page has no axe violations', async () => {
    const { container } = renderWithProviders(<ApiKeysPage />);

    await expectAccessible(container);
  });
});
