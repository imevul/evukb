import { agentNotesRoot } from '../agent-write/types.js';

export const defaultIncludeAgentNotesInRetrieval = true;

export function isAgentNotesPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized === agentNotesRoot || normalized.startsWith(`${agentNotesRoot}/`);
}

export function parseIncludeAgentNotesInRetrieval(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  return undefined;
}

export function validateIncludeAgentNotesInRetrieval(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'boolean') {
    return null;
  }
  return 'settings.includeAgentNotesInRetrieval must be a boolean.';
}

export function resolveIncludeAgentNotesInRetrieval(
  workspaceSettings: Record<string, unknown>,
  corpusSettings?: Record<string, unknown>,
): boolean {
  const corpusValue = parseIncludeAgentNotesInRetrieval(corpusSettings?.includeAgentNotesInRetrieval);
  if (corpusValue !== undefined) {
    return corpusValue;
  }
  const workspaceValue = parseIncludeAgentNotesInRetrieval(
    workspaceSettings.includeAgentNotesInRetrieval,
  );
  return workspaceValue ?? defaultIncludeAgentNotesInRetrieval;
}

export function shouldIncludePathInRetrieval(
  filePath: string,
  includeAgentNotesInRetrieval: boolean,
): boolean {
  if (includeAgentNotesInRetrieval) {
    return true;
  }
  return !isAgentNotesPath(filePath);
}
