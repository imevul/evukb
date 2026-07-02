import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { SettingsService } from '../services/settings-service.js';
import {
  aiProvidersPatchBodySchema,
  parseBody,
  workspaceSettingsPatchBodySchema,
} from './body-schemas.js';

export type SettingsRoutesOptions = {
  settings: SettingsService;
};

type PatchSettingsBody = {
  name?: string;
  settings?: Record<string, unknown>;
};

export const settingsRoutesPlugin: FastifyPluginAsync<SettingsRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/settings', async (request) => {
    const view = await options.settings.getSettings(request.evuKbWorkspace.id);
    return {
      ...view,
      ranking: options.settings.getRankingSettingsView(view?.settings ?? {}),
    };
  });

  server.patch<{ Body: PatchSettingsBody }>('/settings', async (request) => {
    parseBody(workspaceSettingsPatchBodySchema, request.body);
    const updated = await options.settings.updateSettings(request.evuKbWorkspace.id, request.body);
    return {
      ...updated,
      ranking: options.settings.getRankingSettingsView(updated?.settings ?? {}),
    };
  });

  server.get('/ai/providers', async (request) => {
    const view = await options.settings.getAiProviders(request.evuKbWorkspace.id);
    if (!view) {
      throw ApiError.workspaceNotFound(request.evuKbWorkspace.id);
    }
    return view;
  });

  server.patch<{ Body: import('@evu/kb-core').AiProviderSettings }>(
    '/ai/providers',
    async (request) => {
      parseBody(aiProvidersPatchBodySchema, request.body);
      const view = await options.settings.updateAiProviders(
        request.evuKbWorkspace.id,
        request.body ?? {},
      );
      if (!view) {
        throw ApiError.workspaceNotFound(request.evuKbWorkspace.id);
      }
      return view;
    },
  );
};
