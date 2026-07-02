import type {
  ChatCompletionInput,
  ChatCompletionResult,
  ChatCompletionStreamEvent,
  ChatCompletionUsage,
  ChatProvider,
  ChatProviderHealth,
} from '@evu/kb-core';

export type OpenAiChatProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type OpenAiStreamPayload = {
  choices?: Array<{ delta?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export function parseOpenAiChatStreamPayload(payload: string): string | null {
  if (!payload || payload === '[DONE]') {
    return null;
  }
  const parsed = JSON.parse(payload) as OpenAiStreamPayload;
  return parsed.choices?.[0]?.delta?.content ?? null;
}

export function parseOpenAiChatStreamUsage(payload: string): ChatCompletionUsage | undefined {
  if (!payload || payload === '[DONE]') {
    return undefined;
  }
  const parsed = JSON.parse(payload) as OpenAiStreamPayload;
  if (!parsed.usage) {
    return undefined;
  }
  return {
    ...(parsed.usage.prompt_tokens !== undefined
      ? { inputTokens: parsed.usage.prompt_tokens }
      : {}),
    ...(parsed.usage.completion_tokens !== undefined
      ? { outputTokens: parsed.usage.completion_tokens }
      : {}),
  };
}

export class OpenAiChatProvider implements ChatProvider {
  readonly model: string;
  readonly #apiKey: string | undefined;
  readonly #baseUrl: string;

  constructor(options: OpenAiChatProviderOptions = {}) {
    this.model = options.model ?? process.env.EVUKB_CHAT_MODEL ?? 'gpt-4o-mini';
    this.#apiKey = options.apiKey ?? process.env.EVUKB_CHAT_API_KEY;
    this.#baseUrl = (
      options.baseUrl ??
      process.env.EVUKB_CHAT_BASE_URL ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
  }

  async health(): Promise<ChatProviderHealth> {
    if (!this.#apiKey) {
      return {
        status: 'not-configured',
        model: this.model,
        message: 'Chat provider is not configured; ask is unavailable.',
      };
    }
    return { status: 'ok', model: this.model };
  }

  async complete(input: ChatCompletionInput): Promise<ChatCompletionResult> {
    const chunks: string[] = [];
    let usage: ChatCompletionUsage | undefined;
    for await (const event of this.completeStream(input)) {
      if (event.type === 'token') {
        chunks.push(event.delta);
      } else if (event.usage) {
        usage = event.usage;
      }
    }
    return { content: chunks.join(''), ...(usage ? { usage } : {}) };
  }

  async *completeStream(input: ChatCompletionInput): AsyncIterable<ChatCompletionStreamEvent> {
    if (!this.#apiKey) {
      throw new Error('Chat provider is not configured.');
    }

    const startedAt = Date.now();
    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat completion request failed with status ${response.status}.`);
    }

    if (!response.body) {
      yield { type: 'done', usage: { latencyMs: Date.now() - startedAt } };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let capturedUsage: ChatCompletionUsage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.slice('data:'.length).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const delta = parseOpenAiChatStreamPayload(payload);
          if (delta) {
            yield { type: 'token', delta };
          }
          const usage = parseOpenAiChatStreamUsage(payload);
          if (usage) {
            capturedUsage = usage;
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }

    yield {
      type: 'done',
      usage: {
        ...(capturedUsage ?? {}),
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

export function resolveChatProvider(env: NodeJS.ProcessEnv = process.env): ChatProvider | null {
  const apiKey = env.EVUKB_CHAT_API_KEY;
  const baseUrl = env.EVUKB_CHAT_BASE_URL;
  const model = env.EVUKB_CHAT_MODEL;
  if (!apiKey && !baseUrl && !model) {
    return null;
  }
  return new OpenAiChatProvider({
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {}),
  });
}
