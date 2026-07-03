import type { WorkspaceBootHints } from '@evu/kb-sdk';

export type BootHintCard = {
  label: string;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  hint: string;
};

export function buildBootHintCards(hints: WorkspaceBootHints): BootHintCard[] {
  return [
    {
      label: 'Database',
      status: hints.databaseConfigured ? 'Configured' : 'Not configured',
      tone: hints.databaseConfigured ? 'success' : 'danger',
      hint: 'Set EVUKB_DATABASE_URL on the API server.',
    },
    {
      label: 'Blob store',
      status: hints.blobStoreConfigured ? 'Configured' : 'Not configured',
      tone: hints.blobStoreConfigured ? 'success' : 'danger',
      hint: 'Set EVUKB_BLOB_ROOT on the API server.',
    },
    {
      label: 'Mount allowlist',
      status: hints.mountAllowlistConfigured ? 'Configured' : 'Not configured',
      tone: hints.mountAllowlistConfigured ? 'success' : 'neutral',
      hint: 'Optional unless using shared mount import (EVUKB_MOUNT_ALLOWLIST).',
    },
    {
      label: 'Secrets key',
      status: hints.secretsKeyConfigured ? 'Configured' : 'Not configured',
      tone: hints.secretsKeyConfigured ? 'success' : 'warning',
      hint: 'Required for git corpus credentials (EVUKB_SECRETS_KEY).',
    },
    {
      label: 'Mount authoritative mode',
      status: hints.mountAuthoritativeEnabled ? 'Enabled' : 'Disabled',
      tone: hints.mountAuthoritativeEnabled ? 'success' : 'neutral',
      hint: 'EVUKB_ENABLE_MOUNT_AUTHORITATIVE=true on the API server.',
    },
    {
      label: 'Import writeback mode',
      status: hints.importWritebackEnabled ? 'Enabled' : 'Disabled',
      tone: hints.importWritebackEnabled ? 'success' : 'neutral',
      hint: 'EVUKB_ENABLE_IMPORT_WRITEBACK=true on the API server.',
    },
  ];
}
