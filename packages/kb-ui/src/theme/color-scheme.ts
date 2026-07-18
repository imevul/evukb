export type ColorSchemePreference = 'light' | 'dark' | 'system';

export type EffectiveColorScheme = 'light' | 'dark';

export type EvuPalette = 'indigo' | 'blue';

/** Canonical Evu Theme storage key (shared across Evu apps). */
const STORAGE_KEY = 'evu-color-scheme';
/** Legacy EvuKB key — read during migration, rewritten on next preference write. */
const LEGACY_STORAGE_KEY = 'evukb-color-scheme';
const PALETTE_STORAGE_KEY = 'evu-palette';
const DEFAULT_PALETTE: EvuPalette = 'indigo';

function colorSchemeStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function isPreference(value: string | null): value is ColorSchemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isPalette(value: string | null): value is EvuPalette {
  return value === 'indigo' || value === 'blue';
}

export function readStoredColorSchemePreference(): ColorSchemePreference {
  const storage = colorSchemeStorage();
  if (!storage) {
    return 'system';
  }
  const stored = storage.getItem(STORAGE_KEY);
  if (isPreference(stored)) {
    return stored;
  }
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (isPreference(legacy)) {
    return legacy;
  }
  return 'system';
}

export function writeStoredColorSchemePreference(preference: ColorSchemePreference): void {
  const storage = colorSchemeStorage();
  if (!storage) {
    return;
  }
  storage.setItem(STORAGE_KEY, preference);
  // Keep legacy key in sync so older FOUC snippets still resolve correctly.
  storage.setItem(LEGACY_STORAGE_KEY, preference);
}

export function resolveEffectiveColorScheme(
  preference: ColorSchemePreference,
  prefersDark: boolean,
): EffectiveColorScheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return prefersDark ? 'dark' : 'light';
}

export function applyDocumentColorScheme(effective: EffectiveColorScheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', effective === 'dark');
  root.style.colorScheme = effective;
}

export function readStoredEvuPalette(): EvuPalette {
  const storage = colorSchemeStorage();
  if (!storage) {
    return DEFAULT_PALETTE;
  }
  const stored = storage.getItem(PALETTE_STORAGE_KEY);
  return isPalette(stored) ? stored : DEFAULT_PALETTE;
}

export function writeStoredEvuPalette(palette: EvuPalette): void {
  colorSchemeStorage()?.setItem(PALETTE_STORAGE_KEY, palette);
}

export function applyDocumentEvuPalette(palette: EvuPalette = readStoredEvuPalette()): void {
  document.documentElement.dataset.evuPalette = palette;
}

export function readSystemPrefersDark(): boolean {
  if (typeof matchMedia === 'undefined') {
    return false;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
