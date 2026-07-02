export const evuKbCorePackageName = '@evu/kb-core';

export type EvuKbRuntimeMode = 'standalone' | 'remote-service' | 'npm-embed';

export const defaultEmbeddingDimensions = 1536;

export const defaultRankingStrategyId = 'hybrid_default_v1';

export type KnowledgeFormatProfile = 'generic' | 'okf';

export type NodeSourceType = 'managed' | 'shared_mount' | 'git' | 'reference' | 'import';

export type NodeType = 'folder' | 'file';

export type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'stale' | 'failed';

export type LinkKind = 'markdown' | 'wikilink' | 'autolink' | 'citation' | 'external';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'agent';
