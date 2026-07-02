import type {
  KbReadToolRequest,
  KbToolRequest,
  KbToolResponse,
  KbWriteActor,
  KbWriteToolRequest,
} from '@evu/kb-core';
import { isKbReadToolRequest } from '@evu/kb-core';

import type { EvuKbRuntime } from '../runtime/types.js';
import type { AgentWriteService } from './agent-write-service.js';
import { executeKbReadTool } from './kb-tool-handlers.js';

export type KbToolServiceDeps = {
  runtime: EvuKbRuntime | null;
  agentWrite: AgentWriteService;
};

export class KbToolService {
  #runtime: EvuKbRuntime | null;
  readonly #agentWrite: AgentWriteService;

  constructor(deps: KbToolServiceDeps) {
    this.#runtime = deps.runtime;
    this.#agentWrite = deps.agentWrite;
  }

  setRuntime(runtime: EvuKbRuntime): void {
    this.#runtime = runtime;
  }

  async execute(
    workspaceId: string,
    actor: KbWriteActor,
    request: KbToolRequest,
  ): Promise<KbToolResponse> {
    const runtime = this.#runtime;
    if (!runtime) {
      throw new Error('KbToolService runtime is not configured.');
    }
    if (isKbReadToolRequest(request)) {
      return executeKbReadTool(runtime, workspaceId, request as KbReadToolRequest);
    }
    return this.#agentWrite.execute(workspaceId, actor, request as KbWriteToolRequest);
  }
}
