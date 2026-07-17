import { validateIncludeAgentNotesInRetrieval } from '../agent-retrieval/settings.js';
import { validateCorpusAgentMutationApprovalPolicy } from '../agent-write/approval-policy.js';
import {
  validateAgentWritePathPrefixes,
  validateCorpusAgentWritePathPrefixes,
  workspaceAgentWritePathPrefixes,
} from '../agent-write/path-policy.js';
import type { KnowledgeFormatProfile } from '../runtime.js';
import { validateRankingSettings } from '../settings/ranking.js';
import { validateSyncSettings } from '../sync/settings.js';

export type KnowledgeCorpusSettings = {
  formatProfile?: KnowledgeFormatProfile;
  okfStrict?: boolean;
  citationValidationEnabled?: boolean;
};

const FORMAT_PROFILES: KnowledgeFormatProfile[] = ['generic', 'okf'];

export function parseCorpusSettings(settings: Record<string, unknown>): KnowledgeCorpusSettings {
  const parsed: KnowledgeCorpusSettings = {};

  const formatProfile = settings.formatProfile;
  if (formatProfile === 'generic' || formatProfile === 'okf') {
    parsed.formatProfile = formatProfile;
  }

  if (settings.okfStrict === true) {
    parsed.okfStrict = true;
  }

  if (settings.citationValidationEnabled === false) {
    parsed.citationValidationEnabled = false;
  }

  return parsed;
}

export function resolveFormatProfile(settings: Record<string, unknown>): KnowledgeFormatProfile {
  const formatProfile = settings.formatProfile;
  if (formatProfile === 'okf') {
    return 'okf';
  }
  return 'generic';
}

export function isOkfCorpus(settings: Record<string, unknown>): boolean {
  return resolveFormatProfile(settings) === 'okf';
}

export function validateCorpusSettings(
  settings: Record<string, unknown>,
  options: {
    allowMountAuthoritative?: boolean;
    allowImportWriteback?: boolean;
    allowGitWriteback?: boolean;
    workspaceSettings?: Record<string, unknown>;
  } = {},
): string | null {
  const formatProfile = settings.formatProfile;
  if (
    formatProfile !== undefined &&
    !FORMAT_PROFILES.includes(formatProfile as KnowledgeFormatProfile)
  ) {
    return 'settings.formatProfile must be "generic" or "okf".';
  }

  if (settings.okfStrict !== undefined && typeof settings.okfStrict !== 'boolean') {
    return 'settings.okfStrict must be a boolean.';
  }

  if (
    settings.citationValidationEnabled !== undefined &&
    typeof settings.citationValidationEnabled !== 'boolean'
  ) {
    return 'settings.citationValidationEnabled must be a boolean.';
  }

  return (
    validateSyncSettings(settings, options) ??
    validateRankingSettings(settings) ??
    validateIncludeAgentNotesInRetrieval(settings.includeAgentNotesInRetrieval) ??
    validateAgentWritePathPrefixes(settings.agentWritePathPrefixes) ??
    (settings.agentWritePathPrefixes !== undefined
      ? validateCorpusAgentWritePathPrefixes(
          settings.agentWritePathPrefixes,
          workspaceAgentWritePathPrefixes(options.workspaceSettings ?? {}),
        )
      : null) ??
    validateCorpusAgentMutationApprovalPolicy(settings.agentMutationApprovalPolicy)
  );
}

export function isCitationValidationEnabled(settings: Record<string, unknown>): boolean {
  if (!isOkfCorpus(settings)) {
    return false;
  }
  return settings.citationValidationEnabled !== false;
}

export function mergeCorpusSettings(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...existing,
    ...patch,
  };
}
