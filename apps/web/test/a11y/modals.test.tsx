// @vitest-environment jsdom

import './setup.js';

import { ColorSchemeProvider, DisplayPreferencesProvider } from '@evu/kb-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ApiKeysPage } from '../../src/pages/ApiKeysPage.js';
import { DiagnosticsPage } from '../../src/pages/DiagnosticsPage.js';
import { KnowledgeListPage } from '../../src/pages/KnowledgeListPage.js';
import { McpTokensPage } from '../../src/pages/McpTokensPage.js';
import { MutationApprovalsPage } from '../../src/pages/MutationApprovalsPage.js';
import { SecretsPage } from '../../src/pages/SecretsPage.js';
import { WorkspaceProvider } from '../../src/workspace/WorkspaceProvider.js';

// Make dialogs visible to axe: the shared setup stubs showModal/close as
// no-ops, but modal-open checks need the `open` attribute toggled.
HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
});
HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
});

const { kbClientMock } = vi.hoisted(() => ({
  kbClientMock: {
    listCorpora: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'local-dev',
      name: 'EvuKB',
      settings: {},
      ranking: {
        availableStrategies: [{ id: 'hybrid_default_v1', label: 'Hybrid default', version: '1' }],
      },
      bootHints: {
        mountAuthoritativeEnabled: false,
        importWritebackEnabled: false,
        gitWritebackEnabled: false,
      },
    }),
    listSecrets: vi.fn().mockResolvedValue([
      {
        id: 'secret-1',
        workspaceId: 'ws-1',
        name: 'gh-token',
        createdAt: '2026-01-05T10:00:00.000Z',
      },
    ]),
    listApiKeys: vi.fn().mockResolvedValue([]),
    listMcpTokens: vi.fn().mockResolvedValue([]),
    listMutationApprovals: vi.fn().mockResolvedValue([
      {
        id: 'approval-1',
        workspaceId: 'ws-1',
        corpusId: 'corpus-1234-abcd',
        status: 'pending',
        action: 'kb_create_document',
        request: {},
        actor: { kind: 'agent', id: 'agent-1' },
        preview: {
          corpusId: 'corpus-1234-abcd',
          action: 'create',
          path: 'agent-notes/idea.md',
        },
        decidedBy: null,
        decidedAt: null,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-05T10:00:00.000Z',
      },
    ]),
    getHealthDb: vi.fn().mockResolvedValue({ status: 'ok', migrationsApplied: 12 }),
    getHealthBlobStore: vi.fn().mockResolvedValue({ status: 'ok', root: '/data/blobs' }),
    getHealthProviders: vi.fn().mockResolvedValue({
      embedding: { status: 'ok', model: 'embed-model' },
      chat: { status: 'not-configured' },
    }),
    getHealthVectorStore: vi.fn().mockResolvedValue({ backend: 'pgvector', status: 'ok' }),
    listFailedJobs: vi.fn().mockResolvedValue([
      {
        id: 'job-1',
        queueName: 'evukb-index',
        workspaceId: 'ws-1',
        corpusId: 'corpus-1',
        nodeId: null,
        filePath: 'notes/alpha.md',
        failedAt: '2026-01-05T10:00:00.000Z',
        errorMessage: 'Embedding provider timeout.',
        output: { message: 'timeout' },
        payload: { nodeId: 'node-1' },
      },
    ]),
    listUsageRecords: vi.fn().mockResolvedValue([]),
    getUsageSummary: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/api/client.js', () => ({
  kbClient: kbClientMock,
}));

function renderWithProviders(ui: ReactElement): ReturnType<typeof render> {
  return render(
    <ColorSchemeProvider>
      <DisplayPreferencesProvider>
        <MemoryRouter>
          <WorkspaceProvider>{ui}</WorkspaceProvider>
        </MemoryRouter>
      </DisplayPreferencesProvider>
    </ColorSchemeProvider>,
  );
}

async function expectAccessible(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

async function findOpenDialog(name: string | RegExp): Promise<HTMLElement> {
  return await screen.findByRole('dialog', { name });
}

afterEach(() => {
  cleanup();
});

describe('a11y pages', () => {
  it('secrets page has no axe violations', async () => {
    const { container } = renderWithProviders(<SecretsPage />);
    await screen.findByText('gh-token');

    await expectAccessible(container);
  });

  it('diagnostics page has no axe violations', async () => {
    const { container } = renderWithProviders(<DiagnosticsPage />);
    await screen.findByRole('heading', { name: 'Diagnostics' });
    await screen.findByText('Database');

    await expectAccessible(container);
  });

  it('mutation approvals page has no axe violations', async () => {
    const { container } = renderWithProviders(<MutationApprovalsPage />);
    await screen.findByText('kb create document');

    await expectAccessible(container);
  });
});

describe('a11y open modals', () => {
  it('corpus create modal has no axe violations', async () => {
    const { container } = renderWithProviders(<KnowledgeListPage />);
    await screen.findByText('No corpora yet');

    fireEvent.click(screen.getByRole('button', { name: 'Create corpus' }));
    const dialog = await findOpenDialog('Create corpus');

    await expectAccessible(dialog);
    await expectAccessible(container);
  });

  it('api key create modal has no axe violations', async () => {
    const { container } = renderWithProviders(<ApiKeysPage />);
    await screen.findByText('No API keys yet');

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }));
    const dialog = await findOpenDialog('Create API key');

    await expectAccessible(dialog);
    await expectAccessible(container);
  });

  it('mcp token create modal has no axe violations', async () => {
    const { container } = renderWithProviders(<McpTokensPage />);
    await screen.findByText('No MCP tokens yet');

    fireEvent.click(screen.getByRole('button', { name: 'Create MCP token' }));
    const dialog = await findOpenDialog('Create MCP token');

    await expectAccessible(dialog);
    await expectAccessible(container);
  });

  it('secrets create modal has no axe violations', async () => {
    const { container } = renderWithProviders(<SecretsPage />);
    await screen.findByText('gh-token');

    fireEvent.click(screen.getByRole('button', { name: 'Create secret' }));
    const dialog = await findOpenDialog('Create secret');

    await expectAccessible(dialog);
    await expectAccessible(container);
  });

  it('secrets rotate modal has no axe violations', async () => {
    const { container } = renderWithProviders(<SecretsPage />);
    await screen.findByText('gh-token');

    fireEvent.click(screen.getByRole('button', { name: 'Rotate gh-token' }));
    const dialog = await findOpenDialog(/Rotate “gh-token”\?/);

    await expectAccessible(dialog);
    await expectAccessible(container);
  });

  it('mutation approval confirm modal has no axe violations', async () => {
    const { container } = renderWithProviders(<MutationApprovalsPage />);
    await screen.findByText('kb create document');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await findOpenDialog('Approve mutation?');

    await expectAccessible(dialog);
    await expectAccessible(container);
  });
});
