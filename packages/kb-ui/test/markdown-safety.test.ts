import { describe, expect, it } from 'vitest';

import { shouldRenderMarkdownAsPlainText } from '../src/markdown-safety.js';

describe('markdown preview safety exports', () => {
  it('enables rendered markdown preview in the file editor', () => {
    expect(shouldRenderMarkdownAsPlainText()).toBe(false);
  });
});
