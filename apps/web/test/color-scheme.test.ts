/**
 * @vitest-environment jsdom
 */

import {
  applyDocumentColorScheme,
  applyDocumentEvuPalette,
  readStoredColorSchemePreference,
  readStoredEvuPalette,
  resolveEffectiveColorScheme,
  writeStoredColorSchemePreference,
  writeStoredEvuPalette,
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
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-evu-palette');
    document.documentElement.style.colorScheme = '';
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

  it('persists preference under the Evu storage key and mirrors legacy', () => {
    writeStoredColorSchemePreference('dark');
    expect(localStorage.getItem('evu-color-scheme')).toBe('dark');
    expect(localStorage.getItem('evukb-color-scheme')).toBe('dark');
    expect(readStoredColorSchemePreference()).toBe('dark');
    writeStoredColorSchemePreference('system');
  });

  it('dual-reads the legacy EvuKB storage key', () => {
    localStorage.setItem('evukb-color-scheme', 'light');
    expect(readStoredColorSchemePreference()).toBe('light');
  });

  it('toggles the dark class and color-scheme style on the document element', () => {
    applyDocumentColorScheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    applyDocumentColorScheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('applies Evu palette on the document element', () => {
    expect(readStoredEvuPalette()).toBe('indigo');
    writeStoredEvuPalette('blue');
    applyDocumentEvuPalette('blue');
    expect(document.documentElement.dataset.evuPalette).toBe('blue');
    expect(readStoredEvuPalette()).toBe('blue');
  });
});
