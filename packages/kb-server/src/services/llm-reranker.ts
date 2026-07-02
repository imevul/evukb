import type { ChatCompletionUsage, ChatProvider, RankedSearchHit } from '@evu/kb-core';

export type LlmRerankInput = {
  query: string;
  hits: RankedSearchHit[];
  previews: Map<string, string>;
  filePaths?: Map<string, string>;
  chatProvider: ChatProvider;
};

export type LlmRerankResult = {
  hits: RankedSearchHit[];
  usage?: ChatCompletionUsage;
};

export function parseRerankOrder(response: string, validIds: ReadonlySet<string>): string[] | null {
  const trimmed = response.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((id) => typeof id === 'string' && validIds.has(id))
      ) {
        return parsed;
      }
    } catch {
      // fall through to line parsing
    }
  }

  const fromLines = trimmed
    .split('\n')
    .map((line) => line.trim().replace(/^[-*\d.]+\s*/, ''))
    .filter((line) => validIds.has(line));
  return fromLines.length > 0 ? fromLines : null;
}

export function applyRerankOrder(hits: RankedSearchHit[], order: string[]): RankedSearchHit[] {
  const byId = new Map(hits.map((hit) => [hit.chunkId, hit]));
  const reranked: RankedSearchHit[] = [];
  const seen = new Set<string>();

  for (const chunkId of order) {
    const hit = byId.get(chunkId);
    if (!hit || seen.has(chunkId)) {
      continue;
    }
    seen.add(chunkId);
    reranked.push({
      ...hit,
      componentScores: {
        ...hit.componentScores,
        llmRerank: reranked.length + 1,
      },
    });
  }

  for (const hit of hits) {
    if (!seen.has(hit.chunkId)) {
      reranked.push(hit);
    }
  }

  return reranked;
}

export async function rerankWithLlm(input: LlmRerankInput): Promise<LlmRerankResult> {
  if (input.hits.length <= 1) {
    return { hits: input.hits };
  }

  const validIds = new Set(input.hits.map((hit) => hit.chunkId));
  const lines = input.hits.map((hit, index) => {
    const preview = (input.previews.get(hit.chunkId) ?? '').slice(0, 400);
    const filePath = input.filePaths?.get(hit.chunkId);
    const pathLine = filePath ? `filePath=${filePath}` : 'filePath=unknown';
    return `${index + 1}. chunkId=${hit.chunkId} ${pathLine}\n${preview}`;
  });

  const prompt = [
    'Reorder the search result chunks by relevance to the query.',
    'Return ONLY a JSON array of chunkId strings, most relevant first. No prose or markdown.',
    `Query: ${input.query}`,
    'Candidates:',
    ...lines,
  ].join('\n\n');

  try {
    const result = await input.chatProvider.complete({
      messages: [
        {
          role: 'system',
          content:
            'You rerank retrieval candidates for search. Respond with a JSON array of chunkId strings only. Use every listed chunkId exactly once when possible. Do not include explanations.',
        },
        { role: 'user', content: prompt },
      ],
    });
    const order = parseRerankOrder(result.content, validIds);
    if (!order) {
      return { hits: input.hits, ...(result.usage ? { usage: result.usage } : {}) };
    }
    return {
      hits: applyRerankOrder(input.hits, order),
      ...(result.usage ? { usage: result.usage } : {}),
    };
  } catch {
    return { hits: input.hits };
  }
}
