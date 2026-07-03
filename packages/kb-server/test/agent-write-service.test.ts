import { describe, expect, it, vi } from 'vitest';

import { AgentWriteService } from '../src/services/agent-write-service.js';

function buildAgentWriteService(
  overrides: {
    workspaces?: Record<string, unknown>;
    corpora?: Record<string, unknown>;
    nodes?: Record<string, unknown>;
    fileManager?: Record<string, unknown>;
    auditLog?: Record<string, unknown>;
  } = {},
) {
  const workspaces = {
    getById: vi.fn().mockResolvedValue({ id: 'ws-1', settings: {} }),
    ...overrides.workspaces,
  };
  const corpora = {
    getById: vi.fn().mockResolvedValue({ id: 'corpus-1', settings: {} }),
    ...overrides.corpora,
  };

  return new AgentWriteService({
    auditLog: (overrides.auditLog ?? { record: vi.fn() }) as never,
    fileManager: (overrides.fileManager ?? {}) as never,
    nodes: (overrides.nodes ?? {}) as never,
    workspaces: workspaces as never,
    corpora: corpora as never,
    apiKeys: { getById: vi.fn() } as never,
    mcpTokens: { getById: vi.fn() } as never,
  });
}

describe('AgentWriteService', () => {
  it('creates agent-notes files on append when missing', async () => {
    const nodes = {
      getByPathAndName: vi.fn().mockResolvedValue(null),
    };
    const fileManager = {
      createFolder: vi.fn().mockResolvedValue({ id: 'folder-1' }),
      createFile: vi.fn().mockResolvedValue({
        id: 'file-1',
        path: 'agent-notes',
        name: 'note.md',
      }),
      appendContent: vi.fn(),
    };
    const auditLog = {
      record: vi.fn(),
    };

    const service = buildAgentWriteService({ nodes, fileManager, auditLog });

    const result = await service.appendDocument(
      'ws-1',
      { kind: 'dev' },
      {
        action: 'append_document',
        corpusId: 'corpus-1',
        path: 'agent-notes/note.md',
        body: '# Note\n',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'append_document',
      nodeId: 'file-1',
      path: 'agent-notes/note.md',
    });
    expect(fileManager.createFolder).toHaveBeenCalledWith('ws-1', 'corpus-1', {
      path: '',
      name: 'agent-notes',
    });
    expect(fileManager.createFile).toHaveBeenCalled();
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        action: 'append_document',
        actor: { kind: 'dev' },
      }),
    );
  });

  it('rejects append paths outside configured prefixes', async () => {
    const service = buildAgentWriteService();

    await expect(
      service.appendDocument(
        'ws-1',
        { kind: 'open' },
        {
          action: 'append_document',
          corpusId: 'corpus-1',
          path: 'guides/note.md',
          body: 'nope',
        },
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('allows writes under workspace-configured prefixes', async () => {
    const nodes = {
      getByPathAndName: vi.fn().mockResolvedValue(null),
    };
    const fileManager = {
      createFolder: vi.fn().mockResolvedValue({ id: 'folder-1' }),
      createFile: vi.fn().mockResolvedValue({
        id: 'file-2',
        path: 'drafts',
        name: 'plan.md',
      }),
      appendContent: vi.fn(),
    };

    const service = buildAgentWriteService({
      nodes,
      fileManager,
      workspaces: {
        getById: vi.fn().mockResolvedValue({
          id: 'ws-1',
          settings: { agentWritePathPrefixes: ['agent-notes', 'drafts'] },
        }),
      },
    });

    const result = await service.appendDocument(
      'ws-1',
      { kind: 'dev' },
      {
        action: 'append_document',
        corpusId: 'corpus-1',
        path: 'drafts/plan.md',
        body: '# Plan\n',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      path: 'drafts/plan.md',
    });
  });
});
