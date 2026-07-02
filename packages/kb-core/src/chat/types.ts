export type ChatMessageRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type ChatCompletionInput = {
  messages: ChatMessage[];
};

export type ChatCompletionUsage = {
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
};

export type ChatCompletionResult = {
  content: string;
  usage?: ChatCompletionUsage;
};

export type ChatCompletionStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'done'; usage?: ChatCompletionUsage };

export type ChatProviderHealth = {
  status: 'ok' | 'not-configured' | 'error';
  model?: string;
  message?: string;
};

export interface ChatProvider {
  readonly model: string;
  complete(input: ChatCompletionInput): Promise<ChatCompletionResult>;
  completeStream(input: ChatCompletionInput): AsyncIterable<ChatCompletionStreamEvent>;
  health(): Promise<ChatProviderHealth>;
}
