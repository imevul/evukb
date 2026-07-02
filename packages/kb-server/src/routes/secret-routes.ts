import type { FastifyPluginAsync } from 'fastify';

import type { SecretService } from '../services/secret-service.js';
import { parseBody, secretCreateBodySchema, secretRotateBodySchema } from './body-schemas.js';

export type SecretRoutesOptions = {
  secrets: SecretService;
};

type CreateSecretBody = {
  name: string;
  value: string;
};

type RotateSecretBody = {
  value: string;
};

export const secretRoutesPlugin: FastifyPluginAsync<SecretRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/secrets', async (request) => {
    return options.secrets.listSecrets(request.evuKbWorkspace.id);
  });

  server.post<{ Body: CreateSecretBody }>('/secrets', async (request, reply) => {
    parseBody(secretCreateBodySchema, request.body);
    const created = await options.secrets.createSecret(request.evuKbWorkspace.id, request.body);
    reply.code(201);
    return created;
  });

  server.delete<{ Params: { secretId: string } }>('/secrets/:secretId', async (request, reply) => {
    await options.secrets.deleteSecret(request.evuKbWorkspace.id, request.params.secretId);
    reply.code(204);
    return;
  });

  server.patch<{ Params: { secretId: string }; Body: RotateSecretBody }>(
    '/secrets/:secretId',
    async (request) => {
      parseBody(secretRotateBodySchema, request.body);
      return options.secrets.rotateSecret(
        request.evuKbWorkspace.id,
        request.params.secretId,
        request.body,
      );
    },
  );
};
