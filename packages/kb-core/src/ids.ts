export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type CorpusId = string & { readonly __brand: 'CorpusId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type ChunkId = string & { readonly __brand: 'ChunkId' };
export type UserId = string & { readonly __brand: 'UserId' };

export function asWorkspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

export function asCorpusId(value: string): CorpusId {
  return value as CorpusId;
}

export function asNodeId(value: string): NodeId {
  return value as NodeId;
}

export function asChunkId(value: string): ChunkId {
  return value as ChunkId;
}

export function asUserId(value: string): UserId {
  return value as UserId;
}
