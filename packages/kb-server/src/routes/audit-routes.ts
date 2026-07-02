import type { ListAuditLogQuery } from '@evu/kb-core';
import { maxAuditLogLimit } from '@evu/kb-core';
import type { AuditLogRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';

export type AuditRoutesOptions = {
  auditLog: AuditLogRepository;
};

function parseLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw ApiError.validation('limit must be an integer.');
  }
  if (parsed < 1 || parsed > maxAuditLogLimit) {
    throw ApiError.validation(`limit must be between 1 and ${maxAuditLogLimit}.`);
  }
  return parsed;
}

function parseAction(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw ApiError.validation('action must be a string.');
  }
  return value;
}

export const auditRoutesPlugin: FastifyPluginAsync<AuditRoutesOptions> = async (
  server,
  options,
) => {
  server.get<{ Querystring: ListAuditLogQuery }>('/audit', async (request) => {
    const limit = parseLimit(request.query.limit);
    const action = parseAction(request.query.action);

    return options.auditLog.listByWorkspace(request.evuKbWorkspace.id, {
      ...(limit !== undefined ? { limit } : {}),
      ...(action !== undefined ? { action } : {}),
    });
  });
};
