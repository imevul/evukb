import type { KbWriteAction, KbWriteToolRequest } from './types.js';

export type MutationApprovalMode = 'always' | 'never';
export type MutationApprovalInheritMode = 'always' | 'never' | 'inherit';
export type MutationApprovalKey = 'append' | 'create' | 'update' | 'delete';

export type MutationApprovalPolicy = Record<MutationApprovalKey, MutationApprovalMode>;

export type CorpusAgentMutationApprovalPolicy = Partial<
  Record<MutationApprovalKey, MutationApprovalInheritMode>
>;

export const defaultMutationApprovalPolicy: MutationApprovalPolicy = {
  append: 'never',
  create: 'always',
  update: 'always',
  delete: 'always',
};

const APPROVAL_KEYS: MutationApprovalKey[] = ['append', 'create', 'update', 'delete'];
const MODES: MutationApprovalMode[] = ['always', 'never'];
const INHERIT_MODES: MutationApprovalInheritMode[] = ['always', 'never', 'inherit'];

export function mutationApprovalKey(action: KbWriteAction): MutationApprovalKey {
  switch (action) {
    case 'append_document':
      return 'append';
    case 'create_document':
      return 'create';
    case 'update_document':
      return 'update';
    case 'delete_document':
      return 'delete';
  }
}

export function parseMutationApprovalPolicy(raw: unknown): MutationApprovalPolicy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaultMutationApprovalPolicy };
  }

  const input = raw as Record<string, unknown>;
  const parsed = { ...defaultMutationApprovalPolicy };
  for (const key of APPROVAL_KEYS) {
    const value = input[key];
    if (value === 'always' || value === 'never') {
      parsed[key] = value;
    }
  }
  return parsed;
}

export function parseCorpusAgentMutationApprovalPolicy(
  raw: unknown,
): CorpusAgentMutationApprovalPolicy | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const parsed: CorpusAgentMutationApprovalPolicy = {};
  for (const key of APPROVAL_KEYS) {
    const value = input[key];
    if (value === 'always' || value === 'never' || value === 'inherit') {
      parsed[key] = value;
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function resolveMutationApprovalMode(args: {
  key: MutationApprovalKey;
  workspaceSettings: Record<string, unknown>;
  corpusSettings?: Record<string, unknown>;
}): MutationApprovalMode {
  const workspace = parseMutationApprovalPolicy(args.workspaceSettings.mutationApprovalPolicy);
  const corpusOverride = parseCorpusAgentMutationApprovalPolicy(
    args.corpusSettings?.agentMutationApprovalPolicy,
  );
  const corpusValue = corpusOverride?.[args.key];
  if (corpusValue === 'always' || corpusValue === 'never') {
    return corpusValue;
  }
  return workspace[args.key];
}

export function validateMutationApprovalPolicy(raw: unknown): string | null {
  if (raw === undefined) {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'settings.mutationApprovalPolicy must be an object.';
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!APPROVAL_KEYS.includes(key as MutationApprovalKey)) {
      return `settings.mutationApprovalPolicy.${key} is not a supported approval key.`;
    }
    if (!MODES.includes(value as MutationApprovalMode)) {
      return `settings.mutationApprovalPolicy.${key} must be "always" or "never".`;
    }
  }
  return null;
}

export function validateCorpusAgentMutationApprovalPolicy(raw: unknown): string | null {
  if (raw === undefined) {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'settings.agentMutationApprovalPolicy must be an object.';
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!APPROVAL_KEYS.includes(key as MutationApprovalKey)) {
      return `settings.agentMutationApprovalPolicy.${key} is not a supported approval key.`;
    }
    if (!INHERIT_MODES.includes(value as MutationApprovalInheritMode)) {
      return `settings.agentMutationApprovalPolicy.${key} must be "always", "never", or "inherit".`;
    }
  }
  return null;
}

export function buildMutationApprovalPreview(
  request: KbWriteToolRequest,
  resolvedPath?: string,
): {
  corpusId: string;
  action: KbWriteAction;
  path?: string;
  nodeId?: string;
} {
  switch (request.action) {
    case 'append_document':
      return { corpusId: request.corpusId, action: request.action, path: request.path };
    case 'create_document':
      return {
        corpusId: request.corpusId,
        action: request.action,
        path: resolvedPath ?? `${request.path}/${request.name}`.replace(/^\//, ''),
      };
    case 'update_document':
      return {
        corpusId: request.corpusId,
        action: request.action,
        nodeId: request.nodeId,
        ...(resolvedPath ? { path: resolvedPath } : {}),
      };
    case 'delete_document':
      return {
        corpusId: request.corpusId,
        action: request.action,
        nodeId: request.nodeId,
        ...(resolvedPath ? { path: resolvedPath } : {}),
      };
  }
}
