import { z } from 'zod';

import { ApiError } from '../errors.js';
import { knowledgeFiltersSchema } from '../mcp/schemas/knowledge-filters.js';
import { rankingSettingsSchema } from '../mcp/schemas/ranking-settings.js';

/**
 * Runtime validation for HTTP JSON bodies. Schemas are shared with the MCP
 * tool schemas where the shapes overlap (filters, ranking settings).
 * Validation is a guard: routes keep reading the typed request body.
 */
export function parseBody<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue && issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    throw ApiError.validation(`Invalid request body${path}: ${issue?.message ?? 'invalid value'}`);
  }
  return result.data;
}

const settingsRecordSchema = z.record(z.string(), z.unknown());

export const corpusCreateBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  settings: settingsRecordSchema.optional(),
});

export const corpusPatchBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: settingsRecordSchema.optional(),
  rankingStrategyId: z.string().optional(),
});

const searchCommonFields = {
  query: z.string().optional(),
  pathPrefix: z.string().optional(),
  limit: z.number().int().positive().optional(),
  filters: knowledgeFiltersSchema,
  rankingSettings: rankingSettingsSchema.optional(),
  rankingStrategyId: z.string().optional(),
};

export const workspaceSearchBodySchema = z.object({
  ...searchCommonFields,
  corpusIds: z.array(z.string()).optional(),
});

export const corpusSearchBodySchema = z.object(searchCommonFields);

const askCommonFields = {
  question: z.string(),
  nodeId: z.string().optional(),
  pathPrefix: z.string().optional(),
  filters: knowledgeFiltersSchema,
  maxContextChunks: z.number().int().positive().optional(),
  responseMode: z.enum(['concise', 'detailed', 'extractive']).optional(),
  stream: z.boolean().optional(),
  rankingStrategyId: z.string().optional(),
};

export const workspaceAskBodySchema = z.object({
  ...askCommonFields,
  corpusIds: z.array(z.string()).optional(),
});

export const corpusAskBodySchema = z.object(askCommonFields);

export const folderCreateBodySchema = z.object({
  path: z.string().optional(),
  name: z.string(),
});

export const fileCreateJsonBodySchema = z.object({
  path: z.string().optional(),
  name: z.string(),
  content: z.string(),
  mimeType: z.string().nullable().optional(),
});

export const nodeRenameBodySchema = z.object({
  name: z.string(),
});

export const nodeMoveBodySchema = z.object({
  path: z.string(),
});

export const nodeDeleteBodySchema = z.object({
  nodeIds: z.array(z.string()),
});

export const indexNodesBodySchema = z.object({
  nodeIds: z.array(z.string()),
});

export const workspaceSettingsPatchBodySchema = z.object({
  name: z.string().optional(),
  settings: settingsRecordSchema.optional(),
});

const providerOverrideSchema = z
  .object({
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    chunkingStrategy: z.string().optional(),
    maxChunkTokens: z.number().int().positive().optional(),
  })
  .nullable();

export const aiProvidersPatchBodySchema = z.object({
  embedding: providerOverrideSchema.optional(),
  chat: providerOverrideSchema.optional(),
});

export const secretCreateBodySchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const secretRotateBodySchema = z.object({
  value: z.string(),
});

export const tokenCreateBodySchema = z.object({
  name: z.string(),
  scopes: z.array(z.enum(['kb:read', 'kb:write', 'kb:admin'])).optional(),
  expiresAt: z.string().nullable().optional(),
});

export const convertToOkfBodySchema = z.object({
  dryRun: z.boolean().optional(),
  synthesizeIndex: z.boolean().optional(),
});
