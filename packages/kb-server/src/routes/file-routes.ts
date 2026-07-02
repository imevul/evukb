import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import { resolveMaxUploadBytes } from '../limits.js';
import type { FileManagerService } from '../services/file-manager.js';
import {
  fileCreateJsonBodySchema,
  folderCreateBodySchema,
  nodeDeleteBodySchema,
  nodeMoveBodySchema,
  nodeRenameBodySchema,
  parseBody,
} from './body-schemas.js';
import { withNodesMutability } from './node-presentation.js';

export type FileRoutesOptions = {
  fileManager: FileManagerService;
  maxUploadBytes?: number;
};

export const fileRoutesPlugin: FastifyPluginAsync<FileRoutesOptions> = async (server, options) => {
  const maxUploadBytes = options.maxUploadBytes ?? resolveMaxUploadBytes();

  server.get<{
    Params: { corpusId: string };
    Querystring: { format?: 'flat' | 'tree' };
  }>('/knowledge-corpora/:corpusId/nodes', async (request) => {
    const nodes = await options.fileManager.listNodes(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      request.query.format ?? 'flat',
    );
    if (request.query.format === 'tree') {
      return nodes;
    }
    return withNodesMutability(nodes as import('@evu/kb-core').KnowledgeNode[]);
  });

  server.post<{ Params: { corpusId: string }; Body: { path?: string; name: string } }>(
    '/knowledge-corpora/:corpusId/folders',
    async (request, reply) => {
      const body = parseBody(folderCreateBodySchema, request.body);
      const folder = await options.fileManager.createFolder(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        {
          path: body.path ?? '',
          name: body.name,
        },
        { auditActor: request.evuKbActor },
      );
      reply.code(201);
      return folder;
    },
  );

  server.post<{
    Params: { corpusId: string };
    Body: { path?: string; name: string; content: string; mimeType?: string | null };
  }>('/knowledge-corpora/:corpusId/files', async (request, reply) => {
    const contentType = request.headers['content-type'] ?? '';
    let path = '';
    let name = '';
    let mimeType: string | null = null;
    let content: Buffer | null = null;

    if (contentType.includes('application/json')) {
      const body = parseBody(fileCreateJsonBodySchema, request.body);
      path = body.path ?? '';
      name = body.name;
      mimeType = body.mimeType ?? null;
      content = Buffer.from(body.content, 'utf8');
    } else {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          if (buffer.byteLength > maxUploadBytes) {
            throw ApiError.payloadTooLarge(maxUploadBytes);
          }
          content = buffer;
          if (!name) {
            name = part.filename;
          }
          mimeType = part.mimetype ?? null;
          continue;
        }

        if (part.fieldname === 'path') {
          path = String(part.value ?? '');
        }
        if (part.fieldname === 'name') {
          name = String(part.value ?? '');
        }
        if (part.fieldname === 'mimeType') {
          mimeType = String(part.value ?? '');
        }
      }
    }

    if (!content) {
      throw ApiError.validation('File upload content is required.');
    }
    if (content.byteLength > maxUploadBytes) {
      throw ApiError.payloadTooLarge(maxUploadBytes);
    }
    if (!name.trim()) {
      throw ApiError.validation('File name is required.');
    }

    const file = await options.fileManager.createFile(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      {
        path,
        name,
        content,
        mimeType,
      },
      { auditActor: request.evuKbActor },
    );
    reply.code(201);
    return file;
  });

  server.get<{ Params: { corpusId: string; nodeId: string } }>(
    '/knowledge-corpora/:corpusId/nodes/:nodeId/content',
    async (request, reply) => {
      const { node, content } = await options.fileManager.readContent(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.params.nodeId,
      );
      reply.header('content-type', node.mimeType ?? 'application/octet-stream');
      reply.header('x-evukb-node-id', node.id);
      return content;
    },
  );

  server.put<{ Params: { corpusId: string; nodeId: string } }>(
    '/knowledge-corpora/:corpusId/nodes/:nodeId/content',
    async (request) => {
      const rawBody = request.body;
      const content =
        typeof rawBody === 'string'
          ? Buffer.from(rawBody, 'utf8')
          : Buffer.isBuffer(rawBody)
            ? rawBody
            : null;
      if (!content) {
        throw ApiError.validation('Request body must contain file content.');
      }
      if (content.byteLength > maxUploadBytes) {
        throw ApiError.payloadTooLarge(maxUploadBytes);
      }

      const mimeTypeHeader = request.headers['content-type'];
      const mimeType = typeof mimeTypeHeader === 'string' ? mimeTypeHeader : null;
      return options.fileManager.saveContent(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.params.nodeId,
        { content, mimeType },
        { auditActor: request.evuKbActor },
      );
    },
  );

  server.patch<{ Params: { corpusId: string; nodeId: string }; Body: { name: string } }>(
    '/knowledge-corpora/:corpusId/nodes/:nodeId',
    async (request) => {
      const body = parseBody(nodeRenameBodySchema, request.body);
      if (!body.name) {
        throw ApiError.validation('Name is required.');
      }
      return options.fileManager.renameNode(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.params.nodeId,
        body.name,
        { auditActor: request.evuKbActor },
      );
    },
  );

  server.patch<{ Params: { corpusId: string; nodeId: string }; Body: { path: string } }>(
    '/knowledge-corpora/:corpusId/nodes/:nodeId/move',
    async (request) => {
      const body = parseBody(nodeMoveBodySchema, request.body);
      return options.fileManager.moveNode(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.params.nodeId,
        body.path,
        { auditActor: request.evuKbActor },
      );
    },
  );

  server.delete<{ Params: { corpusId: string }; Body: { nodeIds: string[] } }>(
    '/knowledge-corpora/:corpusId/nodes',
    async (request, reply) => {
      const { nodeIds } = parseBody(nodeDeleteBodySchema, request.body);
      if (nodeIds.length === 0) {
        throw ApiError.validation('nodeIds must contain at least one id.');
      }
      const result = await options.fileManager.deleteNodes(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        nodeIds,
        { auditActor: request.evuKbActor },
      );
      reply.code(200);
      return result;
    },
  );
};
