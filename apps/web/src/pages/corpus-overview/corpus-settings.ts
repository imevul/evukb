import type {
  IndexEnqueueResponse,
  KnowledgeCorpus,
  OkfConvertResult,
  RankingSettings,
} from '@evu/kb-sdk';

export type ApprovalKey = 'append' | 'create' | 'update' | 'delete';
export type ApprovalInheritMode = 'inherit' | 'always' | 'never';
export type MountModeChoice = 'import' | 'mount_authoritative' | 'import_writeback';
export type OverridesTab = 'ranking' | 'approval' | 'agent';
export type AgentNotesRetrievalMode = 'inherit' | 'include' | 'exclude';

export const APPROVAL_KEYS: ApprovalKey[] = ['append', 'create', 'update', 'delete'];

export const corpusRankingFields: Array<{
  key: keyof RankingSettings;
  label: string;
  hint: string;
}> = [
  {
    key: 'keywordWeight',
    label: 'Keyword weight',
    hint: 'Multiplier on the keyword RRF component.',
  },
  {
    key: 'semanticWeight',
    label: 'Semantic weight',
    hint: 'Multiplier on the semantic RRF component.',
  },
  {
    key: 'recencyBoost',
    label: 'Recency boost',
    hint: 'Extra score for recently indexed docs; 0 disables.',
  },
];

export function readCorpusRanking(settings: Record<string, unknown>): RankingSettings {
  const raw = settings.rankingSettings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as RankingSettings;
}

export function readCorpusApprovalPolicy(
  settings: Record<string, unknown>,
): Record<ApprovalKey, ApprovalInheritMode> {
  const defaults: Record<ApprovalKey, ApprovalInheritMode> = {
    append: 'inherit',
    create: 'inherit',
    update: 'inherit',
    delete: 'inherit',
  };
  const raw = settings.agentMutationApprovalPolicy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }
  for (const key of APPROVAL_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === 'always' || value === 'never' || value === 'inherit') {
      defaults[key] = value;
    }
  }
  return defaults;
}

export function readCorpusAgentNotesRetrieval(
  settings: Record<string, unknown>,
): AgentNotesRetrievalMode {
  const raw = settings.includeAgentNotesInRetrieval;
  if (raw === true) {
    return 'include';
  }
  if (raw === false) {
    return 'exclude';
  }
  return 'inherit';
}

export function readCorpusAgentWritePathPrefixes(settings: Record<string, unknown>): string[] {
  const raw = settings.agentWritePathPrefixes;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

export function formatAgentWritePathPrefixesInput(prefixes: string[]): string {
  return prefixes.join('\n');
}

export function parseAgentWritePathPrefixesInput(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function readWorkspaceAgentWritePathPrefixes(settings: Record<string, unknown>): string[] {
  const parsed = readCorpusAgentWritePathPrefixes(settings);
  return parsed.length > 0 ? parsed : ['agent-notes'];
}

export function defaultAgentNotesRetrievalOverride(): AgentNotesRetrievalMode {
  return 'inherit';
}

export function corpusOverridesEnabled(
  corpus: KnowledgeCorpus,
  workspaceRankingStrategyId: string,
): boolean {
  const ranking = readCorpusRanking(corpus.settings ?? {});
  const hasRankingWeights = Object.values(ranking).some(
    (value) => value !== undefined && value !== null,
  );
  const hasApprovalOverride = APPROVAL_KEYS.some(
    (key) => readCorpusApprovalPolicy(corpus.settings ?? {})[key] !== 'inherit',
  );
  const hasAgentRetrievalOverride =
    readCorpusAgentNotesRetrieval(corpus.settings ?? {}) !== 'inherit';
  const hasAgentWritePathOverride =
    readCorpusAgentWritePathPrefixes(corpus.settings ?? {}).length > 0;
  return (
    hasRankingWeights ||
    hasApprovalOverride ||
    hasAgentRetrievalOverride ||
    hasAgentWritePathOverride ||
    corpus.rankingStrategyId !== workspaceRankingStrategyId
  );
}

export function defaultApprovalOverrides(): Record<ApprovalKey, ApprovalInheritMode> {
  return {
    append: 'inherit',
    create: 'inherit',
    update: 'inherit',
    delete: 'inherit',
  };
}

export function summarizeReindexEnqueue(response: IndexEnqueueResponse): string {
  if (response.enqueued === 0) {
    return 'No indexing jobs were enqueued.';
  }
  return `Enqueued ${response.enqueued} indexing job${response.enqueued === 1 ? '' : 's'}.`;
}

export function summarizeConvertResult(result: OkfConvertResult): string {
  const parts = [`Updated ${result.updated}`, `skipped ${result.skipped}`];
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`);
  }
  if (result.readOnlyBlocked.length > 0) {
    parts.push(`${result.readOnlyBlocked.length} read-only blocked`);
  }
  return parts.join(', ');
}
