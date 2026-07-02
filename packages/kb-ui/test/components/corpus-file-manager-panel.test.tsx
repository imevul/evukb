// @vitest-environment jsdom

import './setup.js';

import type { EvuKbClient, KnowledgeNode } from '@evu/kb-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// CodeMirror is lazy-loaded via dynamic import and does not run in jsdom;
// replace it with a plain textarea that keeps the same value/onChange contract.
vi.mock('../../src/file-manager/CodeMirrorFileEditor.js', () => ({
  CodeMirrorFileEditor: ({
    value,
    onChange,
    readOnly = false,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Code editor"
      onChange={(event) => onChange?.(event.target.value)}
      readOnly={readOnly}
      value={value}
    />
  ),
}));

import { CorpusFileManagerPanel } from '../../src/file-manager/CorpusFileManagerPanel.js';
import { useCorpusFileManager } from '../../src/hooks/useCorpusFileManager.js';

const WORKSPACE_ID = 'ws-1';
const CORPUS_ID = 'corpus-1';

function makeNode(overrides: Partial<KnowledgeNode> & { id: string; name: string }): KnowledgeNode {
  return {
    workspaceId: WORKSPACE_ID,
    corpusId: CORPUS_ID,
    parentId: null,
    path: '',
    nodeType: 'file',
    storageRelPath: null,
    sourceType: 'managed',
    sourceRef: null,
    contentHash: null,
    mimeType: 'text/markdown',
    sizeBytes: 42,
    indexStatus: 'indexed',
    metadata: {},
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    indexedAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

function makeFixtureNodes(): KnowledgeNode[] {
  return [
    makeNode({ id: 'folder-docs', name: 'docs', nodeType: 'folder', sizeBytes: 0 }),
    makeNode({ id: 'file-alpha', name: 'alpha.md' }),
    makeNode({ id: 'file-guide', name: 'guide.md', parentId: 'folder-docs', path: 'docs' }),
  ];
}

function makeClient(initialNodes: KnowledgeNode[] = makeFixtureNodes()) {
  let nodes = [...initialNodes];
  return {
    listNodes: vi.fn(async () => [...nodes]),
    getCorpus: vi.fn(async () => ({ id: CORPUS_ID, settings: {} })),
    createFile: vi.fn(
      async (_ws: string, _corpus: string, input: { path?: string; name: string }) => {
        const created = makeNode({
          id: `created-${input.name}`,
          name: input.name,
          path: input.path ?? '',
        });
        nodes = [...nodes, created];
        return created;
      },
    ),
    createFolder: vi.fn(
      async (_ws: string, _corpus: string, input: { path?: string; name: string }) => {
        const created = makeNode({
          id: `created-folder-${input.name}`,
          name: input.name,
          nodeType: 'folder',
          path: input.path ?? '',
          sizeBytes: 0,
        });
        nodes = [...nodes, created];
        return created;
      },
    ),
    renameNode: vi.fn(async (_ws: string, _corpus: string, nodeId: string, name: string) => {
      nodes = nodes.map((node) => (node.id === nodeId ? { ...node, name } : node));
    }),
    deleteNodes: vi.fn(async (_ws: string, _corpus: string, nodeIds: string[]) => {
      nodes = nodes.filter((node) => !nodeIds.includes(node.id));
    }),
    reindexNodes: vi.fn(async () => {}),
    moveNode: vi.fn(async () => {}),
    readNodeContent: vi.fn(async () => '# Alpha\n\nBody.\n'),
    saveNodeContent: vi.fn(async () => {}),
  };
}

type FakeClient = ReturnType<typeof makeClient>;

function Panel({ client }: { client: FakeClient }): ReactElement {
  const manager = useCorpusFileManager({
    client: client as unknown as EvuKbClient,
    workspaceId: WORKSPACE_ID,
    corpusId: CORPUS_ID,
  });
  return <CorpusFileManagerPanel {...manager} />;
}

describe('CorpusFileManagerPanel', () => {
  it('lists root folders and files after loading', async () => {
    render(<Panel client={makeClient()} />);

    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('docs')).toBeTruthy();
    expect(screen.getByText('alpha.md')).toBeTruthy();
    expect(screen.queryByText('guide.md')).toBeNull();
  });

  it('opens a folder on double-click and navigates back via the parent row', async () => {
    render(<Panel client={makeClient()} />);

    fireEvent.doubleClick(await screen.findByText('docs'));

    expect(await screen.findByText('guide.md')).toBeTruthy();
    expect(screen.queryByText('alpha.md')).toBeNull();

    fireEvent.doubleClick(screen.getByText('..'));
    expect(await screen.findByText('alpha.md')).toBeTruthy();
  });

  it('filters entries by name or path', async () => {
    render(<Panel client={makeClient()} />);
    await screen.findByText('docs');

    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'guide' } });

    expect(screen.getByText('guide.md')).toBeTruthy();
    expect(screen.queryByText('alpha.md')).toBeNull();
  });

  it('scopes reindexing to the selected file', async () => {
    const client = makeClient();
    render(<Panel client={client} />);

    fireEvent.click(await screen.findByText('alpha.md'));

    const reindex = screen.getByRole('button', { name: 'Reindex' });
    expect(reindex.getAttribute('title')).toBe('Re-index selected markdown files');

    fireEvent.click(reindex);
    await waitFor(() =>
      expect(client.reindexNodes).toHaveBeenCalledWith(WORKSPACE_ID, CORPUS_ID, ['file-alpha']),
    );
  });

  it('creates a file through the New file modal and opens the editor', async () => {
    const client = makeClient();
    render(<Panel client={client} />);
    await screen.findByText('docs');

    fireEvent.click(screen.getByRole('button', { name: 'New file' }));
    await screen.findByRole('heading', { name: 'Create file' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ideas.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create file' }));

    expect(await screen.findByText('File “ideas.md” created.')).toBeTruthy();
    expect(client.createFile).toHaveBeenCalledWith(WORKSPACE_ID, CORPUS_ID, {
      path: '',
      name: 'ideas.md',
      content: '# New note\n',
    });

    expect(await screen.findByRole('heading', { name: 'Edit ideas.md' })).toBeTruthy();
    expect(client.readNodeContent).toHaveBeenCalledWith(
      WORKSPACE_ID,
      CORPUS_ID,
      'created-ideas.md',
    );
  });

  it('creates a folder through the New folder modal', async () => {
    const client = makeClient();
    render(<Panel client={client} />);
    await screen.findByText('docs');

    fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
    await screen.findByRole('heading', { name: 'Create folder' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'runbooks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));

    expect(await screen.findByText('Folder “runbooks” created.')).toBeTruthy();
    expect(client.createFolder).toHaveBeenCalledWith(WORKSPACE_ID, CORPUS_ID, {
      path: '',
      name: 'runbooks',
    });
    expect(await screen.findByText('runbooks')).toBeTruthy();
  });

  it('renames a file from the context menu', async () => {
    const client = makeClient();
    render(<Panel client={client} />);

    fireEvent.contextMenu(await screen.findByText('alpha.md'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = (await screen.findByLabelText('Name')) as HTMLInputElement;
    expect(input.value).toBe('alpha.md');

    fireEvent.change(input, { target: { value: 'omega.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByText('omega.md')).toBeTruthy();
    expect(client.renameNode).toHaveBeenCalledWith(
      WORKSPACE_ID,
      CORPUS_ID,
      'file-alpha',
      'omega.md',
    );
  });

  it('deletes a file after confirming the destructive modal', async () => {
    const client = makeClient();
    render(<Panel client={client} />);

    fireEvent.contextMenu(await screen.findByText('alpha.md'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'Delete “alpha.md”?' })).toBeTruthy();
    expect(client.deleteNodes).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('alpha.md')).toBeNull());
    expect(client.deleteNodes).toHaveBeenCalledWith(WORKSPACE_ID, CORPUS_ID, ['file-alpha']);
  });

  it('opens a file, edits it, and saves through the client', async () => {
    const client = makeClient();
    render(<Panel client={client} />);

    fireEvent.doubleClick(await screen.findByText('alpha.md'));
    await screen.findByRole('heading', { name: 'Edit alpha.md' });

    const editor = (await screen.findByLabelText('Code editor')) as HTMLTextAreaElement;
    expect(editor.value).toContain('# Alpha');

    fireEvent.change(editor, { target: { value: '# Alpha\n\nUpdated body.\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved “alpha.md”.')).toBeTruthy();
    expect(client.saveNodeContent).toHaveBeenCalledWith(
      WORKSPACE_ID,
      CORPUS_ID,
      'file-alpha',
      expect.stringContaining('Updated body.'),
    );
  });
});
