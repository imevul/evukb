import {
  type ArchiveImportLimits,
  type EmbeddingChunkingStrategy,
  maxPortableZipEntries,
  resolveEmbeddingChunkingStrategyFromSettings,
  resolveMaxChunkTokensFromSettings,
  type SettingSource,
} from '@evu/kb-core';

/** Default compressed upload size (100 MiB). */
const defaultMaxUploadBytes = 100 * 1024 * 1024;

/** Default total uncompressed bytes inside an imported archive (500 MiB). */
const defaultMaxArchiveImportBytes = 500 * 1024 * 1024;

export function resolveMaxUploadBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVUKB_MAX_UPLOAD_BYTES;
  if (!raw) {
    return defaultMaxUploadBytes;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EVUKB_MAX_UPLOAD_BYTES must be a positive integer, received "${raw}"`);
  }
  return parsed;
}

export function resolveMaxArchiveImportBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES;
  if (!raw) {
    return defaultMaxArchiveImportBytes;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EVUKB_MAX_ARCHIVE_IMPORT_BYTES must be a positive integer, received "${raw}"`);
  }
  return parsed;
}

export function resolveArchiveImportLimits(
  env: NodeJS.ProcessEnv = process.env,
): ArchiveImportLimits {
  return {
    maxEntries: maxPortableZipEntries,
    maxUncompressedBytes: resolveMaxArchiveImportBytes(env),
  };
}

const defaultEmbeddingBatchSize = 8;
const defaultEmbeddingMaxRetries = 3;

export function resolveEmbeddingBatchSize(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVUKB_EMBEDDING_BATCH_SIZE;
  if (!raw) {
    return defaultEmbeddingBatchSize;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EVUKB_EMBEDDING_BATCH_SIZE must be a positive integer, received "${raw}"`);
  }
  return parsed;
}

export function resolveEmbeddingMaxRetries(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVUKB_EMBEDDING_MAX_RETRIES;
  if (!raw) {
    return defaultEmbeddingMaxRetries;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `EVUKB_EMBEDDING_MAX_RETRIES must be a non-negative integer, received "${raw}"`,
    );
  }
  return parsed;
}

export function resolveChunkingStrategy(
  settings: Record<string, unknown> = {},
  env: NodeJS.ProcessEnv = process.env,
): { value: EmbeddingChunkingStrategy; source: SettingSource } {
  return resolveEmbeddingChunkingStrategyFromSettings(settings, env);
}

export function resolveMaxChunkTokens(
  settings: Record<string, unknown> = {},
  env: NodeJS.ProcessEnv = process.env,
): { value: number; source: SettingSource } {
  return resolveMaxChunkTokensFromSettings(settings, env);
}
