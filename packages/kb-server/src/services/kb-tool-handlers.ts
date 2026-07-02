import type {
  AskToolRequest,
  FollowLinksRequest,
  GetDocumentRequest,
  KbReadToolRequest,
  KbReadToolSuccessResponse,
  ListConceptsRequest,
  ListCorporaRequest,
  ListDocumentsRequest,
  ReadChunkRequest,
  ReadIndexRequest,
  SearchToolRequest,
} from '@evu/kb-core';
import {
  buildDocumentInventoryRows,
  defaultRankingStrategyRegistry,
  hasListDocumentsInventoryOptions,
  parseFrontmatter,
  readNodeFrontmatter,
} from '@evu/kb-core';

import { ApiError } from '../errors.js';
import type { EvuKbRuntime } from '../runtime/types.js';

function readSuccess<T>(
  action: KbReadToolSuccessResponse['action'],
  result: T,
): KbReadToolSuccessResponse {
  return { ok: true, action, result };
}

function assertValidRankingStrategyId(rankingStrategyId: string | undefined): void {
  if (rankingStrategyId === undefined) {
    return;
  }
  try {
    defaultRankingStrategyRegistry.resolve(rankingStrategyId);
  } catch {
    throw ApiError.validation(`Unknown ranking strategy: ${rankingStrategyId}`);
  }
}

export async function handleListCorpora(
  runtime: EvuKbRuntime,
  workspaceId: string,
  _request: ListCorporaRequest,
): Promise<KbReadToolSuccessResponse> {
  const corpora = await runtime.corpora.listByWorkspace(workspaceId);
  return readSuccess('list_corpora', corpora);
}

export async function handleSearch(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: SearchToolRequest,
): Promise<KbReadToolSuccessResponse> {
  const corpusIds = request.corpusIds ?? (request.corpusId ? [request.corpusId] : undefined);
  if (!corpusIds || corpusIds.length === 0) {
    throw ApiError.validation('corpusId or corpusIds is required for search.');
  }

  assertValidRankingStrategyId(request.rankingStrategyId);

  const searchRequest = {
    ...(request.query !== undefined ? { query: request.query } : {}),
    ...(request.pathPrefix !== undefined ? { pathPrefix: request.pathPrefix } : {}),
    ...(request.limit !== undefined ? { limit: request.limit } : {}),
    ...(request.filters !== undefined ? { filters: request.filters } : {}),
    ...(request.rankingStrategyId !== undefined
      ? { rankingStrategyId: request.rankingStrategyId }
      : {}),
    ...(request.rankingSettings !== undefined ? { rankingSettings: request.rankingSettings } : {}),
  };

  if (corpusIds.length === 1 && corpusIds[0]) {
    const results = await runtime.searchService.search(workspaceId, corpusIds[0], searchRequest);
    return readSuccess('search', results);
  }

  const results = await runtime.searchService.searchAcrossCorpora(
    workspaceId,
    corpusIds,
    searchRequest,
  );
  return readSuccess('search', results);
}

export async function handleReadChunk(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: ReadChunkRequest,
): Promise<KbReadToolSuccessResponse> {
  const chunk = await runtime.chunks.getById(workspaceId, request.corpusId, request.chunkId);
  if (!chunk) {
    throw ApiError.notFound(`Chunk not found: ${request.chunkId}`);
  }
  return readSuccess('read_chunk', {
    chunkId: chunk.id,
    nodeId: chunk.nodeId,
    filePath: chunk.filePath,
    headingPath: chunk.headingPath,
    body: chunk.body,
    bodyPreview: chunk.bodyPreview,
  });
}

export async function handleListDocuments(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: ListDocumentsRequest,
): Promise<KbReadToolSuccessResponse> {
  const nodes = await runtime.fileManager.listNodes(workspaceId, request.corpusId, 'flat');
  const fileNodes = nodes.filter((node) => node.nodeType === 'file');
  const inventoryOptions = {
    ...(request.pathPrefix !== undefined ? { pathPrefix: request.pathPrefix } : {}),
    ...(request.filters !== undefined ? { filters: request.filters } : {}),
    ...(request.fields !== undefined ? { fields: request.fields } : {}),
    ...(request.limit !== undefined ? { limit: request.limit } : {}),
    ...(request.offset !== undefined ? { offset: request.offset } : {}),
  };
  if (hasListDocumentsInventoryOptions(inventoryOptions)) {
    return readSuccess('list_documents', buildDocumentInventoryRows(fileNodes, inventoryOptions));
  }
  return readSuccess('list_documents', fileNodes);
}

export async function handleGetDocument(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: GetDocumentRequest,
): Promise<KbReadToolSuccessResponse> {
  const { node, content } = await runtime.fileManager.readContent(
    workspaceId,
    request.corpusId,
    request.nodeId,
  );
  const body = content.toString('utf8');
  const frontmatterFromMetadata = readNodeFrontmatter(node.metadata);
  const frontmatter =
    request.includeFrontmatter === true
      ? Object.keys(frontmatterFromMetadata).length > 0
        ? frontmatterFromMetadata
        : parseFrontmatter(body).parsed
      : undefined;
  return readSuccess('get_document', {
    nodeId: node.id,
    path: node.path ? `${node.path}/${node.name}` : node.name,
    mimeType: node.mimeType,
    body,
    ...(frontmatter ? { frontmatter } : {}),
  });
}

export async function handleFollowLinks(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: FollowLinksRequest,
): Promise<KbReadToolSuccessResponse> {
  const links = await runtime.links.listByNode(workspaceId, request.corpusId, request.nodeId);
  return readSuccess('follow_links', links);
}

export async function handleReadIndex(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: ReadIndexRequest,
): Promise<KbReadToolSuccessResponse> {
  const index = await runtime.okfService.readIndex(
    workspaceId,
    request.corpusId,
    request.documentPath,
  );
  return readSuccess('read_index', index);
}

export async function handleListConcepts(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: ListConceptsRequest,
): Promise<KbReadToolSuccessResponse> {
  const concepts = await runtime.okfService.listConcepts(workspaceId, request.corpusId, {
    ...(request.pathPrefix !== undefined ? { pathPrefix: request.pathPrefix } : {}),
    ...(request.conceptType !== undefined ? { conceptType: request.conceptType } : {}),
    ...(request.tag !== undefined ? { tag: request.tag } : {}),
    ...(request.limit !== undefined ? { limit: request.limit } : {}),
    ...(request.offset !== undefined ? { offset: request.offset } : {}),
  });
  return readSuccess('list_concepts', concepts);
}

export async function handleAskTool(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: AskToolRequest,
): Promise<KbReadToolSuccessResponse> {
  const corpusIds = request.corpusIds ?? (request.corpusId ? [request.corpusId] : undefined);
  if (!corpusIds || corpusIds.length === 0) {
    throw ApiError.validation('corpusId or corpusIds is required for ask.');
  }

  assertValidRankingStrategyId(request.rankingStrategyId);

  const response = await runtime.askService.askCorpora(workspaceId, {
    question: request.question,
    corpusIds,
    ...(request.nodeId !== undefined ? { nodeId: request.nodeId } : {}),
    ...(request.pathPrefix !== undefined ? { pathPrefix: request.pathPrefix } : {}),
    ...(request.filters !== undefined ? { filters: request.filters } : {}),
    ...(request.maxContextChunks !== undefined
      ? { maxContextChunks: request.maxContextChunks }
      : {}),
    ...(request.responseMode !== undefined ? { responseMode: request.responseMode } : {}),
    ...(request.rankingStrategyId !== undefined
      ? { rankingStrategyId: request.rankingStrategyId }
      : {}),
  });
  return readSuccess('ask', response);
}

export async function executeKbReadTool(
  runtime: EvuKbRuntime,
  workspaceId: string,
  request: KbReadToolRequest,
): Promise<KbReadToolSuccessResponse> {
  switch (request.action) {
    case 'list_corpora':
      return handleListCorpora(runtime, workspaceId, request);
    case 'search':
      return handleSearch(runtime, workspaceId, request);
    case 'read_chunk':
      return handleReadChunk(runtime, workspaceId, request);
    case 'list_documents':
      return handleListDocuments(runtime, workspaceId, request);
    case 'get_document':
      return handleGetDocument(runtime, workspaceId, request);
    case 'follow_links':
      return handleFollowLinks(runtime, workspaceId, request);
    case 'read_index':
      return handleReadIndex(runtime, workspaceId, request);
    case 'list_concepts':
      return handleListConcepts(runtime, workspaceId, request);
    case 'ask':
      return handleAskTool(runtime, workspaceId, request);
    default: {
      const exhaustive: never = request;
      throw ApiError.validation(
        `Unsupported read action: ${(exhaustive as { action: string }).action}`,
      );
    }
  }
}
