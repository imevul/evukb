export const embeddingChunkingStrategies = [
  'headings',
  'headings_subsplit',
  'headings_subsplit_capped',
] as const;

export type EmbeddingChunkingStrategy = (typeof embeddingChunkingStrategies)[number];

export const defaultEmbeddingChunkingStrategy: EmbeddingChunkingStrategy = 'headings';

export const defaultMaxChunkTokens = 512;

export const minMaxChunkTokens = 64;

export const maxMaxChunkTokens = 8192;

export function isEmbeddingChunkingStrategy(value: string): value is EmbeddingChunkingStrategy {
  return (embeddingChunkingStrategies as readonly string[]).includes(value);
}

export function parseMaxChunkTokens(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
