import { describe, expect, it, vi } from 'vitest';

import { AgentWriteService } from '../src/services/agent-write-service.js';

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

    const service = new AgentWriteService({
      auditLog: auditLog as never,
      fileManager: fileManager as never,
      nodes: nodes as never,
    });

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

  it('rejects append paths outside agent-notes/', async () => {
    const service = new AgentWriteService({
      auditLog: { record: vi.fn() } as never,
      fileManager: {} as never,
      nodes: {} as never,
    });

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
});
