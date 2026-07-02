import type {
  KbToolPendingApprovalResponse,
  KbWriteAction,
  KbWriteToolRequest,
  KbWriteToolSuccessResponse,
} from '../agent-write/types.js';
import type { AskResponse, AskResponseMode } from '../ask/types.js';
import type { KnowledgeCorpus } from '../corpus.js';
import type { KnowledgeLink } from '../link.js';
import type { KnowledgeNode } from '../node.js';
import type { KnowledgeFilters } from '../search/filters.js';
import type { SearchResult } from '../search/types.js';
import type { RankingSettings } from '../settings/types.js';

export type KbReadAction =
  | 'list_corpora'
  | 'search'
  | 'read_chunk'
  | 'list_documents'
  | 'get_document'
  | 'follow_links'
  | 'read_index'
  | 'list_concepts'
  | 'ask';

export type ListCorporaRequest = {
  action: 'list_corpora';
};

export type SearchToolRequest = {
  action: 'search';
  corpusId?: string;
  corpusIds?: string[];
  query?: string;
  pathPrefix?: string;
  limit?: number;
  filters?: KnowledgeFilters;
  rankingStrategyId?: string;
  rankingSettings?: RankingSettings;
};

export type ReadChunkRequest = {
  action: 'read_chunk';
  corpusId: string;
  chunkId: string;
};

export type ListDocumentsRequest = {
  action: 'list_documents';
  corpusId: string;
  pathPrefix?: string;
  filters?: KnowledgeFilters;
  fields?: string[];
  limit?: number;
  offset?: number;
};

export type GetDocumentRequest = {
  action: 'get_document';
  corpusId: string;
  nodeId: string;
  includeFrontmatter?: boolean;
};

export type FollowLinksRequest = {
  action: 'follow_links';
  corpusId: string;
  nodeId: string;
};

export type ReadIndexRequest = {
  action: 'read_index';
  corpusId: string;
  documentPath?: string;
};

export type ListConceptsRequest = {
  action: 'list_concepts';
  corpusId: string;
  pathPrefix?: string;
  conceptType?: string;
  tag?: string;
  limit?: number;
  offset?: number;
};

export type AskToolRequest = {
  action: 'ask';
  corpusId?: string;
  corpusIds?: string[];
  question: string;
  nodeId?: string;
  pathPrefix?: string;
  filters?: KnowledgeFilters;
  maxContextChunks?: number;
  responseMode?: AskResponseMode;
  stream?: boolean;
  rankingStrategyId?: string;
};

export type KbReadToolRequest =
  | ListCorporaRequest
  | SearchToolRequest
  | ReadChunkRequest
  | ListDocumentsRequest
  | GetDocumentRequest
  | FollowLinksRequest
  | ReadIndexRequest
  | ListConceptsRequest
  | AskToolRequest;

export type KbToolRequest = KbReadToolRequest | KbWriteToolRequest;

export type KbToolAction = KbReadAction | KbWriteAction;

export type ReadChunkResult = {
  chunkId: string;
  nodeId: string;
  filePath: string;
  headingPath: string[];
  body: string;
  bodyPreview: string;
};

export type GetDocumentResult = {
  nodeId: string;
  path: string;
  mimeType: string | null;
  body: string;
  frontmatter?: Record<string, unknown>;
};

export type KbReadToolSuccessResponse = {
  ok: true;
  action: KbReadAction;
  result:
    | KnowledgeCorpus[]
    | SearchResult[]
    | ReadChunkResult
    | KnowledgeNode[]
    | GetDocumentResult
    | KnowledgeLink[]
    | unknown
    | AskResponse;
};

export type KbToolSuccessResponse = KbWriteToolSuccessResponse | KbReadToolSuccessResponse;

export type KbToolResponse = KbToolSuccessResponse | KbToolPendingApprovalResponse;

export const kbReadActions: KbReadAction[] = [
  'list_corpora',
  'search',
  'read_chunk',
  'list_documents',
  'get_document',
  'follow_links',
  'read_index',
  'list_concepts',
  'ask',
];

export const kbWriteActions: KbWriteAction[] = [
  'append_document',
  'create_document',
  'update_document',
  'delete_document',
];

export function isKbReadAction(action: string): action is KbReadAction {
  return (kbReadActions as string[]).includes(action);
}

export function isKbWriteAction(action: string): action is KbWriteAction {
  return (kbWriteActions as string[]).includes(action);
}

export function isKbReadToolRequest(request: KbToolRequest): request is KbReadToolRequest {
  return isKbReadAction(request.action);
}

export function isKbWriteToolRequest(request: KbToolRequest): request is KbWriteToolRequest {
  return isKbWriteAction(request.action);
}
