import type { ApiErrorCode } from '@evu/kb-core';

export type { ApiErrorCode } from '@evu/kb-core';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(code: ApiErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }

  static notFound(message: string): ApiError {
    return new ApiError('not_found', message, 404);
  }

  static workspaceNotFound(workspaceId: string): ApiError {
    return new ApiError('workspace_not_found', `Workspace not found: ${workspaceId}`, 404);
  }

  static corpusNotFound(corpusId: string): ApiError {
    return new ApiError('corpus_not_found', `Corpus not found: ${corpusId}`, 404);
  }

  static nodeNotFound(nodeId: string): ApiError {
    return new ApiError('node_not_found', `Node not found: ${nodeId}`, 404);
  }

  static conflict(message: string): ApiError {
    return new ApiError('conflict', message, 409);
  }

  static validation(message: string): ApiError {
    return new ApiError('validation_error', message, 400);
  }

  static payloadTooLarge(maxBytes: number): ApiError {
    return new ApiError(
      'payload_too_large',
      `Payload exceeds the maximum allowed size of ${maxBytes} bytes.`,
      413,
    );
  }

  static forbidden(message: string): ApiError {
    return new ApiError('forbidden', message, 403);
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError('service_unavailable', message, 503);
  }
}

export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
};
