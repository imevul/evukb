import { describe, expect, it } from 'vitest';

import { cn } from '../src/cn.js';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('de-duplicates conflicting Tailwind utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-muted', 'bg-primary')).toBe('bg-primary');
  });

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});
