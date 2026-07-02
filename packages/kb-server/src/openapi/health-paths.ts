export const healthPaths = {
  '/health': {
    get: {
      summary: 'Return API health.',
      responses: {
        '200': { description: 'Health response.' },
      },
    },
  },
  '/health/db': {
    get: {
      summary: 'Return database health.',
      responses: {
        '200': { description: 'Database health response.' },
      },
    },
  },
  '/health/blob-store': {
    get: {
      summary: 'Return blob store health.',
      responses: {
        '200': { description: 'Blob store health response.' },
      },
    },
  },
  '/health/providers': {
    get: {
      summary: 'Return AI provider health.',
      responses: {
        '200': { description: 'Provider health response.' },
      },
    },
  },
  '/health/vector-store': {
    get: {
      summary: 'Return vector store health.',
      responses: {
        '200': { description: 'Vector store health response.' },
      },
    },
  },
  '/version': {
    get: {
      summary: 'Return API version.',
      responses: {
        '200': { description: 'Version response.' },
      },
    },
  },
};
