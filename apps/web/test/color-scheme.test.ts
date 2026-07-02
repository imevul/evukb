/**
 * @vitest-environment jsdom
 */

import {
  applyDocumentColorScheme,
  readStoredColorSchemePreference,
  resolveEffectiveColorScheme,
  writeStoredColorSchemePreference,
} from '@evu/kb-ui';
import { beforeEach, describe, expect, it } from 'vitest';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('color scheme', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it('defaults to system preference', () => {
    expect(readStoredColorSchemePreference()).toBe('system');
  });

  it('resolves explicit and system preferences', () => {
    expect(resolveEffectiveColorScheme('light', true)).toBe('light');
    expect(resolveEffectiveColorScheme('dark', false)).toBe('dark');
    expect(resolveEffectiveColorScheme('system', true)).toBe('dark');
    expect(resolveEffectiveColorScheme('system', false)).toBe('light');
  });

  it('persists preference in localStorage', () => {
    writeStoredColorSchemePreference('dark');
    expect(readStoredColorSchemePreference()).toBe('dark');
    writeStoredColorSchemePreference('system');
  });

  it('toggles the dark class on the document element', () => {
    applyDocumentColorScheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyDocumentColorScheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
