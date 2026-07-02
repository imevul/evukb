export const workspaceIdParam = {
  name: 'workspaceId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

export const corpusIdParam = {
  name: 'corpusId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const nodeIdParam = {
  name: 'nodeId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const approvalIdParam = {
  name: 'approvalId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const tokenIdParam = {
  name: 'tokenId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const keyIdParam = {
  name: 'keyId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const secretIdParam = {
  name: 'secretId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const jobIdParam = {
  name: 'jobId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const errorResponse = {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['error', 'code'],
      },
    },
  },
};

export function jsonBody(properties: Record<string, unknown>) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties,
        },
      },
    },
  };
}
