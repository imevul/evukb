import {
  defaultEmbeddingDimensions,
  type EmbeddingProvider,
  type EmbeddingProviderHealth,
} from '@evu/kb-core';

import { resolveEmbeddingBatchSize, resolveEmbeddingMaxRetries } from '../limits.js';

export type OpenAiEmbeddingProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
  maxRetries?: number;
};

const TRANSIENT_EMBEDDING_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readResponseSnippet(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (text.length > 0) {
      return text.slice(0, 500);
    }
  } catch {
    // ignore read failures
  }
  return response.statusText || 'Unknown error';
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  readonly #apiKey: string | undefined;
  readonly #baseUrl: string;
  readonly #batchSize: number;
  readonly #maxRetries: number;

  constructor(options: OpenAiEmbeddingProviderOptions = {}) {
    this.model = options.model ?? process.env.EVUKB_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    this.dimensions = options.dimensions ?? defaultEmbeddingDimensions;
    this.#apiKey = options.apiKey ?? process.env.EVUKB_EMBEDDING_API_KEY;
    this.#baseUrl = (
      options.baseUrl ??
      process.env.EVUKB_EMBEDDING_BASE_URL ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    this.#batchSize = options.batchSize ?? resolveEmbeddingBatchSize();
    this.#maxRetries = options.maxRetries ?? resolveEmbeddingMaxRetries();
  }

  async health(): Promise<EmbeddingProviderHealth> {
    if (!this.#apiKey) {
      return {
        status: 'not-configured',
        model: this.model,
        message: 'Embedding provider is not configured; keyword search remains available.',
      };
    }
    return { status: 'ok', model: this.model };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.#apiKey) {
      throw new Error('Embedding provider is not configured.');
    }
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += this.#batchSize) {
      const batch = texts.slice(offset, offset + this.#batchSize);
      embeddings.push(...(await this.#embedBatchWithRetry(batch)));
    }
    return embeddings;
  }

  async #embedBatchWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      try {
        return await this.#embedBatchOnce(texts);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable =
          error instanceof EmbeddingRequestError &&
          TRANSIENT_EMBEDDING_STATUSES.has(error.status) &&
          attempt < this.#maxRetries;
        if (!retryable) {
          throw lastError;
        }
        await sleep(500 * 2 ** attempt);
      }
    }

    throw lastError ?? new Error('Embedding request failed.');
  }

  async #embedBatchOnce(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.#baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const detail = await readResponseSnippet(response);
      throw new EmbeddingRequestError(response.status, detail);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return (payload.data ?? []).map((entry) => entry.embedding ?? []);
  }
}

export class EmbeddingRequestError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`Embedding request failed with status ${status}: ${detail}`);
    this.name = 'EmbeddingRequestError';
    this.status = status;
  }
}

export function resolveEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProvider | null {
  const apiKey = env.EVUKB_EMBEDDING_API_KEY;
  const baseUrl = env.EVUKB_EMBEDDING_BASE_URL;
  const model = env.EVUKB_EMBEDDING_MODEL;
  if (!apiKey && !baseUrl && !model) {
    return null;
  }
  return new OpenAiEmbeddingProvider({
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {}),
  });
}
