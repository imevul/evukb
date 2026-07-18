import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  applyDocumentColorScheme,
  applyDocumentEvuPalette,
  type ColorSchemePreference,
  type EffectiveColorScheme,
  readStoredColorSchemePreference,
  readSystemPrefersDark,
  resolveEffectiveColorScheme,
  writeStoredColorSchemePreference,
} from './color-scheme.js';

type ColorSchemeContextValue = {
  preference: ColorSchemePreference;
  effective: EffectiveColorScheme;
  setPreference: (preference: ColorSchemePreference) => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(() =>
    readStoredColorSchemePreference(),
  );
  const [prefersDark, setPrefersDark] = useState(() => readSystemPrefersDark());

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setPrefersDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const effective = useMemo(
    () => resolveEffectiveColorScheme(preference, prefersDark),
    [preference, prefersDark],
  );

  useEffect(() => {
    applyDocumentEvuPalette();
  }, []);

  useEffect(() => {
    applyDocumentColorScheme(effective);
  }, [effective]);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    writeStoredColorSchemePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      effective,
      setPreference,
    }),
    [preference, effective, setPreference],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme(): ColorSchemeContextValue {
  const value = useContext(ColorSchemeContext);
  if (!value) {
    throw new Error('useColorScheme must be used within ColorSchemeProvider');
  }
  return value;
}
