import type { CreatedMcpToken, McpTokenRecord } from '@evu/kb-sdk';
import { useMemo } from 'react';

import { kbClient } from '../api/client.js';
import { McpSetupGuide } from '../components/McpSetupGuide.js';
import { KB_AUTH_SCOPE_AREAS_MCP } from '../components/KbAuthScopePicker.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';
import {
  CredentialTokensPage,
  type CredentialTokensPageConfig,
} from './credentials/CredentialTokensPage.js';

export function McpTokensPage() {
  const { selectedSlug } = useWorkspace();
  const mcpTokensPageConfig = useMemo<CredentialTokensPageConfig<McpTokenRecord, CreatedMcpToken>>(
    () => ({
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
      scopeAreas: KB_AUTH_SCOPE_AREAS_MCP,
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
      list: () => kbClient.listMcpTokens(selectedSlug),
      create: (input) => kbClient.createMcpToken(selectedSlug, input),
      revoke: async (id) => {
        await kbClient.revokeMcpToken(selectedSlug, id);
      },
      rotate: (id) => kbClient.rotateMcpToken(selectedSlug, id),
      secretOf: (created) => created.token,
      renderLayout: (panel, createdSecret) => (
        <div className="flex flex-col gap-6">
          <McpSetupGuide mcpToken={createdSecret?.token ?? null} />
          {panel}
        </div>
      ),
    }),
    [selectedSlug],
  );

  return <CredentialTokensPage config={mcpTokensPageConfig} />;
}
