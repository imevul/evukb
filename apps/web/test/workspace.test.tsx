// @vitest-environment jsdom

import { EvuKbApiError } from '@evu/kb-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { kbClient } from '../src/api/client.js';
import { WorkspaceProvider, useWorkspace } from '../src/workspace/WorkspaceProvider.js';
import {
  clearSelectedWorkspaceSlug,
  readSelectedWorkspaceSlug,
  writeSelectedWorkspaceSlug,
} from '../src/workspace/storage.js';

vi.mock('../src/api/client.js', () => ({
  kbClient: {
    getSettings: vi.fn(),
    listWorkspaces: vi.fn(),
  },
}));

function Probe() {
  const { selectedSlug, status, errorMessage } = useWorkspace();
  return (
    <div>
      <span data-testid="slug">{selectedSlug}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{errorMessage ?? ''}</span>
    </div>
  );
}

describe('workspace storage', () => {
  beforeEach(() => {
    clearSelectedWorkspaceSlug();
  });

  it('persists selected slug in localStorage', () => {
    expect(readSelectedWorkspaceSlug()).toBeNull();
    writeSelectedWorkspaceSlug('ops');
    expect(readSelectedWorkspaceSlug()).toBe('ops');
  });
});

describe('WorkspaceProvider', () => {
  beforeEach(() => {
    clearSelectedWorkspaceSlug();
    vi.mocked(kbClient.getSettings).mockReset();
    vi.mocked(kbClient.getSettings).mockRejectedValue(
      new EvuKbApiError(404, 'workspace_not_found', 'Workspace not found: local-dev'),
    );
  });

  it('maps workspace_not_found to not_found status', async () => {
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('not_found');
    });
    expect(screen.getByTestId('error').textContent).toContain('Workspace not found');
  });

  it('writes selected slug to localStorage when switching workspaces', async () => {
    vi.mocked(kbClient.getSettings).mockImplementation(async (slug: string) => {
      if (slug === 'ops') {
        return {
          id: '00000000-0000-4000-8000-000000000001',
          slug: 'ops',
          name: 'Ops',
          settings: {},
          bootHints: {
            databaseConfigured: true,
            blobStoreConfigured: true,
            mountAllowlistConfigured: false,
            secretsKeyConfigured: false,
            mountAuthoritativeEnabled: false,
            importWritebackEnabled: false,
          },
          ranking: {
            strategyId: 'hybrid_default_v1',
            settings: {},
            source: 'default',
            note: '',
            availableStrategies: [],
          },
        };
      }
      throw new EvuKbApiError(404, 'workspace_not_found', `Workspace not found: ${slug}`);
    });

    function Switcher() {
      const workspace = useWorkspace();
      return (
        <button onClick={() => workspace.setSelectedSlug('ops')} type="button">
          switch
        </button>
      );
    }

    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <Switcher />
        </WorkspaceProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    await waitFor(() => {
      expect(readSelectedWorkspaceSlug()).toBe('ops');
    });
  });
});
