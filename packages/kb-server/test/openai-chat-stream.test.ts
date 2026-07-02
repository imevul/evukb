import { describe, expect, it } from 'vitest';

import {
  parseOpenAiChatStreamPayload,
  parseOpenAiChatStreamUsage,
} from '../src/adapters/openai-chat.js';

describe('parseOpenAiChatStreamPayload', () => {
  it('extracts token deltas from OpenAI SSE payloads', () => {
    const payload = JSON.stringify({
      choices: [{ delta: { content: 'Hello' } }],
    });
    expect(parseOpenAiChatStreamPayload(payload)).toBe('Hello');
  });

  it('returns null for DONE markers', () => {
    expect(parseOpenAiChatStreamPayload('[DONE]')).toBeNull();
  });

  it('extracts token usage from OpenAI SSE payloads', () => {
    const payload = JSON.stringify({
      usage: { prompt_tokens: 9, completion_tokens: 12, total_tokens: 21 },
    });
    expect(parseOpenAiChatStreamUsage(payload)).toEqual({
      inputTokens: 9,
      outputTokens: 12,
    });
  });
});
