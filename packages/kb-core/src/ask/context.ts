import type { Citation } from '../citation.js';
import type { SearchResult } from '../search/types.js';

import { type AskResponseMode, weakEvidenceScoreThreshold } from './types.js';

export type AskContextBlock = {
  index: number;
  label: string;
  content: string;
};

export function buildAskContextBlocks(chunks: SearchResult[]): AskContextBlock[] {
  return chunks.map((chunk, index) => {
    const heading =
      chunk.headingPath.length > 0 ? chunk.headingPath.join(' > ') : '(document root)';
    return {
      index: index + 1,
      label: `${chunk.filePath} — ${heading}`,
      content: chunk.bodyPreview,
    };
  });
}

export function formatAskContextForPrompt(blocks: AskContextBlock[]): string {
  if (blocks.length === 0) {
    return '(No retrieved context.)';
  }
  return blocks.map((block) => `[${block.index}] ${block.label}\n${block.content}`).join('\n\n');
}

export function deriveAskCitations(chunks: SearchResult[]): Citation[] {
  return chunks.map((chunk) => chunk.citation);
}

export function buildAskSystemPrompt(responseMode: AskResponseMode): string {
  const modeHint =
    responseMode === 'concise'
      ? 'Keep answers brief and direct.'
      : responseMode === 'extractive'
        ? 'Prefer quoting or closely paraphrasing retrieved passages.'
        : 'Provide a clear, well-structured answer with enough detail.';

  return [
    'You answer questions using only the numbered context passages provided.',
    'When you rely on a passage, cite it inline using [n] where n matches the passage number.',
    'If the context does not contain enough evidence, say so explicitly.',
    'Do not invent facts or citations beyond the provided passages.',
    modeHint,
  ].join(' ');
}

export function buildAskUserPrompt(question: string, contextText: string): string {
  return [`Context:\n${contextText}`, `Question: ${question}`].join('\n\n');
}

export function buildAskWarnings(chunks: SearchResult[], responseMode: AskResponseMode): string[] {
  const warnings: string[] = [];

  if (chunks.length === 0) {
    warnings.push('No indexed chunks matched the question; answer may be uncertain.');
    return warnings;
  }

  const maxScore = Math.max(...chunks.map((chunk) => chunk.score));
  if (maxScore < weakEvidenceScoreThreshold) {
    warnings.push('Retrieved evidence scores are weak; verify against source documents.');
  }

  if (responseMode === 'extractive' && chunks.length < 2) {
    warnings.push('Extractive mode received limited context; answer may be incomplete.');
  }

  return warnings;
}
