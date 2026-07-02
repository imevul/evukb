export type ColorSchemePreference = 'light' | 'dark' | 'system';

export type EffectiveColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'evukb-color-scheme';

function colorSchemeStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export function readStoredColorSchemePreference(): ColorSchemePreference {
  const storage = colorSchemeStorage();
  if (!storage) {
    return 'system';
  }
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function writeStoredColorSchemePreference(preference: ColorSchemePreference): void {
  colorSchemeStorage()?.setItem(STORAGE_KEY, preference);
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
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export function readSystemPrefersDark(): boolean {
  if (typeof matchMedia === 'undefined') {
    return false;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
