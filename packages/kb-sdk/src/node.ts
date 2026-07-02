export type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'stale' | 'failed';

export type NodeMutability = {
  editable: boolean;
  reason?: string;
};

export type KnowledgeNode = {
  id: string;
  workspaceId: string;
  corpusId: string;
  parentId: string | null;
  path: string;
  name: string;
  nodeType: 'file' | 'folder';
  storageRelPath: string | null;
  sourceType: string;
  sourceRef: string | null;
  contentHash: string | null;
  mimeType: string | null;
  sizeBytes: number;
  indexStatus: IndexStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
  mutability?: NodeMutability;
};

export type CreateFileRequest = {
  path?: string;
  name: string;
  content: string;
  mimeType?: string | null;
};

export type CreateFolderRequest = {
  path?: string;
  name: string;
};
