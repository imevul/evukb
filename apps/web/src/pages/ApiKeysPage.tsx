import type { ApiKeyRecord, CreatedApiKey } from '@evu/kb-sdk';
import { useMemo } from 'react';

import { kbClient } from '../api/client.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';
import {
  CredentialTokensPage,
  type CredentialTokensPageConfig,
} from './credentials/CredentialTokensPage.js';

export function ApiKeysPage() {
  const { selectedSlug } = useWorkspace();
  const apiKeysPageConfig = useMemo<CredentialTokensPageConfig<ApiKeyRecord, CreatedApiKey>>(
    () => ({
      formId: 'create-api-key-form',
      idPrefix: 'api-key',
      heading: 'API keys',
      intro:
        'Workspace-scoped bearer keys for HTTP clients. Secrets are shown once on create or rotate.',
      createButtonLabel: 'Create API key',
      submitLabel: 'Create key',
      modalTitle: 'Create API key',
      scopeHint:
        'Read covers search and tools/kb retrieval. Write is required for agent document mutations.',
      secretBannerLabel: 'Copy this key now:',
      loadingText: 'Loading API keys…',
      emptyTitle: 'No API keys yet',
      emptyHint: 'Create an API key for programmatic access.',
      loadErrorFallback: 'Failed to load API keys.',
      createErrorFallback: 'Failed to create API key.',
      rotateErrorFallback: 'Failed to rotate API key.',
      revokeBody: 'Clients using this API key will lose access immediately.',
      revokeConfirmLabel: 'Revoke key',
      rotateBody:
        'A new API key will be created with the same name and scopes. The current key stops working immediately.',
      rotateConfirmLabel: 'Rotate key',
      list: () => kbClient.listApiKeys(selectedSlug),
      create: (input) => kbClient.createApiKey(selectedSlug, input),
      revoke: async (id) => {
        await kbClient.revokeApiKey(selectedSlug, id);
      },
      rotate: (id) => kbClient.rotateApiKey(selectedSlug, id),
      secretOf: (created) => created.key,
    }),
    [selectedSlug],
  );

  return <CredentialTokensPage config={apiKeysPageConfig} />;
}
