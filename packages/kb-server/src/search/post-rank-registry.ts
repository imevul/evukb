import type { ChatCompletionUsage, ChatProvider, RankedSearchHit } from '@evu/kb-core';

import { rerankWithLlm } from '../services/llm-reranker.js';

export type PostRankContext = {
  workspaceId: string;
  corpusId: string;
  query: string;
  hits: RankedSearchHit[];
  previews: Map<string, string>;
  filePaths: Map<string, string>;
  chatProvider: ChatProvider | null;
};

export type PostRankResult = {
  hits: RankedSearchHit[];
  usage?: ChatCompletionUsage;
};

export type PostRankHandler = (context: PostRankContext) => Promise<PostRankResult>;

export type PostRankHandlerRegistry = {
  register: (key: string, handler: PostRankHandler) => void;
  unregister: (key: string) => void;
  resolve: (key: string) => PostRankHandler;
  list: () => string[];
};

export function createDefaultPostRankHandlerRegistry(): PostRankHandlerRegistry {
  const handlers = new Map<string, PostRankHandler>();

  const registry: PostRankHandlerRegistry = {
    register(key, handler) {
      handlers.set(key, handler);
    },
    unregister(key) {
      if (!handlers.has(key)) {
        throw new Error(`Unknown post-rank handler: ${key}`);
      }
      handlers.delete(key);
    },
    resolve(key) {
      const handler = handlers.get(key);
      if (!handler) {
        throw new Error(`Unknown post-rank handler: ${key}`);
      }
      return handler;
    },
    list() {
      return [...handlers.keys()];
    },
  };

  registry.register('llm', async (context) => {
    if (!context.chatProvider) {
      throw new Error('LLM post-rank requires a configured chat provider.');
    }
    const rerankResult = await rerankWithLlm({
      query: context.query,
      hits: context.hits,
      previews: context.previews,
      filePaths: context.filePaths,
      chatProvider: context.chatProvider,
    });
    return {
      hits: rerankResult.hits,
      ...(rerankResult.usage ? { usage: rerankResult.usage } : {}),
    };
  });

  return registry;
}

export const defaultPostRankHandlerRegistry = createDefaultPostRankHandlerRegistry();
