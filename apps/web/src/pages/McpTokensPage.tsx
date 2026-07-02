import type { CreatedMcpToken, McpTokenRecord } from '@evu/kb-sdk';

import { kbClient } from '../api/client.js';
import { McpSetupGuide } from '../components/McpSetupGuide.js';
import { appConfig } from '../config.js';
import {
  CredentialTokensPage,
  type CredentialTokensPageConfig,
} from './credentials/CredentialTokensPage.js';

const mcpTokensPageConfig: CredentialTokensPageConfig<McpTokenRecord, CreatedMcpToken> = {
  formId: 'create-mcp-token-form',
  idPrefix: 'mcp-token',
  heading: 'MCP tokens',
  intro:
    'Workspace-scoped bearer tokens for MCP clients. Secrets are shown once on create or rotate.',
  createButtonLabel: 'Create MCP token',
  submitLabel: 'Create token',
  modalTitle: 'Create MCP token',
  scopeHint:
    'Capable agents like Cursor usually need kb:read. Add kb:write when the client should create or edit agent-notes.',
  secretBannerLabel: 'Copy this token now:',
  loadingText: 'Loading tokens…',
  emptyTitle: 'No MCP tokens yet',
  emptyHint: 'Create an MCP token for agent access.',
  loadErrorFallback: 'Failed to load MCP tokens.',
  createErrorFallback: 'Failed to create MCP token.',
  rotateErrorFallback: 'Failed to rotate MCP token.',
  revokeBody: 'MCP clients using this token will lose access immediately.',
  revokeConfirmLabel: 'Revoke token',
  rotateBody:
    'A new MCP token will be created with the same name and scopes. The current token stops working immediately.',
  rotateConfirmLabel: 'Rotate token',
  list: () => kbClient.listMcpTokens(appConfig.workspaceId),
  create: (input) => kbClient.createMcpToken(appConfig.workspaceId, input),
  revoke: async (id) => {
    await kbClient.revokeMcpToken(appConfig.workspaceId, id);
  },
  rotate: (id) => kbClient.rotateMcpToken(appConfig.workspaceId, id),
  secretOf: (created) => created.token,
  renderLayout: (panel, createdSecret) => (
    <div className="flex flex-col gap-6">
      <McpSetupGuide mcpToken={createdSecret?.token ?? null} />
      {panel}
    </div>
  ),
};

export function McpTokensPage() {
  return <CredentialTokensPage config={mcpTokensPageConfig} />;
}
