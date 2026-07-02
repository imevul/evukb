import type { ApiKeyRecord, CreatedApiKey } from '@evu/kb-sdk';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';
import {
  CredentialTokensPage,
  type CredentialTokensPageConfig,
} from './credentials/CredentialTokensPage.js';

const apiKeysPageConfig: CredentialTokensPageConfig<ApiKeyRecord, CreatedApiKey> = {
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
  list: () => kbClient.listApiKeys(appConfig.workspaceId),
  create: (input) => kbClient.createApiKey(appConfig.workspaceId, input),
  revoke: async (id) => {
    await kbClient.revokeApiKey(appConfig.workspaceId, id);
  },
  rotate: (id) => kbClient.rotateApiKey(appConfig.workspaceId, id),
  secretOf: (created) => created.key,
};

export function ApiKeysPage() {
  return <CredentialTokensPage config={apiKeysPageConfig} />;
}
