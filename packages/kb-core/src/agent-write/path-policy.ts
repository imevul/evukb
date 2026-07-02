import { normalizeRelativePath } from '../storage/path-safety.js';
import { agentNotesRoot } from './types.js';

export class AgentWritePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentWritePathError';
  }
}

export function normalizeAgentWritePath(input: string): string {
  const trimmed = input.trim().replace(/^\/+/, '');
  if (!trimmed) {
    throw new AgentWritePathError('Path is required.');
  }
  try {
    return normalizeRelativePath(trimmed);
  } catch {
    throw new AgentWritePathError(`Unsafe relative path: ${input}`);
  }
}

export function assertAgentNotesPath(input: string): string {
  const normalized = normalizeAgentWritePath(input);
  if (normalized !== agentNotesRoot && !normalized.startsWith(`${agentNotesRoot}/`)) {
    throw new AgentWritePathError(`Agent write path must be under "${agentNotesRoot}/".`);
  }
  return normalized;
}

export function splitAgentWritePath(fullPath: string): { folderPath: string; name: string } {
  const normalized = assertAgentNotesPath(fullPath);
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex === -1) {
    throw new AgentWritePathError('Agent write path must include a file name.');
  }
  return {
    folderPath: normalized.slice(0, slashIndex),
    name: normalized.slice(slashIndex + 1),
  };
}

export function joinAgentWritePath(folderPath: string, name: string): string {
  const normalizedName = normalizeAgentWritePath(name);
  if (normalizedName.includes('/')) {
    throw new AgentWritePathError('File name must not contain path separators.');
  }
  if (!folderPath || folderPath === agentNotesRoot) {
    return `${agentNotesRoot}/${normalizedName}`;
  }
  return assertAgentNotesPath(`${folderPath}/${normalizedName}`);
}
