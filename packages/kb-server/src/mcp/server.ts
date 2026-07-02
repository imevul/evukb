import { McpServer } from '@modelcontextprotocol/server';

import type { EvuKbRuntime } from '../runtime/types.js';
import { resolveMcpEnableAsk } from './config.js';
import {
  registerAskTools,
  registerChunkTools,
  registerCorpusTools,
  registerDocumentTools,
  registerGraphTools,
  registerLinkTools,
  registerOkfTools,
  registerSearchTools,
  registerWorkspaceTools,
  registerWriteDocumentTools,
} from './tools/index.js';

export function buildMcpServer(runtime: EvuKbRuntime): McpServer {
  const server = new McpServer({
    name: 'evukb',
    version: '0.1.0',
  });

  registerWorkspaceTools(server, runtime);
  registerCorpusTools(server, runtime);
  registerDocumentTools(server, runtime);
  registerSearchTools(server, runtime);
  registerChunkTools(server, runtime);
  registerLinkTools(server, runtime);
  registerOkfTools(server, runtime);
  registerGraphTools(server, runtime);
  if (resolveMcpEnableAsk()) {
    registerAskTools(server, runtime);
  }
  registerWriteDocumentTools(server, runtime);

  return server;
}
