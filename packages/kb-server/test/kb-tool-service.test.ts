import type { KbReadToolRequest, KbWriteToolRequest } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import type { EvuKbRuntime } from '../src/index.js';
import type { AgentWriteService } from '../src/services/agent-write-service.js';
import { KbToolService } from '../src/services/kb-tool-service.js';

vi.mock('../src/services/kb-tool-handlers.js', () => ({
  executeKbReadTool: vi.fn(async (_runtime, _workspaceId, request: KbReadToolRequest) => ({
    ok: true,
    action: request.action,
    result: { mocked: true },
  })),
}));

import { executeKbReadTool } from '../src/services/kb-tool-handlers.js';

describe('KbToolService', () => {
  it('dispatches read actions through shared handlers', async () => {
    const runtime = {} as EvuKbRuntime;
    const agentWrite = {
      execute: vi.fn(),
    } as unknown as AgentWriteService;
    const service = new KbToolService({ runtime, agentWrite });
    service.setRuntime(runtime);

    const response = await service.execute(
      'workspace-1',
      { kind: 'api_key', tokenId: 'key-1' },
      { action: 'list_corpora' },
    );

    expect(executeKbReadTool).toHaveBeenCalledWith(runtime, 'workspace-1', {
      action: 'list_corpora',
    });
    expect(response).toMatchObject({ ok: true, action: 'list_corpora' });
    expect(agentWrite.execute).not.toHaveBeenCalled();
  });

  it('delegates write actions to AgentWriteService', async () => {
    const runtime = {} as EvuKbRuntime;
    const writeRequest: KbWriteToolRequest = {
      action: 'append_document',
      corpusId: 'corpus-1',
      path: 'notes/readme.md',
      body: 'hello',
    };
    const agentWrite = {
      execute: vi.fn().mockResolvedValue({ ok: true, action: 'append_document' }),
    } as unknown as AgentWriteService;
    const service = new KbToolService({ runtime, agentWrite });
    service.setRuntime(runtime);

    const response = await service.execute(
      'workspace-1',
      { kind: 'api_key', tokenId: 'key-1' },
      writeRequest,
    );

    expect(agentWrite.execute).toHaveBeenCalledWith(
      'workspace-1',
      { kind: 'api_key', tokenId: 'key-1' },
      writeRequest,
    );
    expect(response).toMatchObject({ ok: true, action: 'append_document' });
  });
});
