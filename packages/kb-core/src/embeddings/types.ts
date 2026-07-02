export type EmbeddingProviderHealth = {
  status: 'ok' | 'not-configured' | 'error';
  model?: string;
  message?: string;
};

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
  health(): Promise<EmbeddingProviderHealth>;
}
