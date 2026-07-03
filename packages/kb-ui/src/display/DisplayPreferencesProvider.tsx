import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  type DisplayPreferences,
  type EffectiveDisplayPreferences,
  readStoredDisplayPreferences,
  resolveDisplayPreferences,
  writeStoredDisplayPreferences,
} from './display-preferences.js';
import { formatDateTime } from './format-date-time.js';

type DisplayPreferencesContextValue = {
  preferences: DisplayPreferences;
  effectivePreferences: EffectiveDisplayPreferences;
  setPreferences: (next: DisplayPreferences) => void;
  patchPreferences: (patch: Partial<DisplayPreferences>) => void;
  formatDateTime: (value: string | Date | number | null | undefined) => string;
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null);

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const v = useContext(DisplayPreferencesContext);
  if (!v) {
    throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider');
  }
  return v;
}

/** Shorthand for formatting timestamps with current display preferences. */
export function useFormatDateTime(): (value: string | Date | number | null | undefined) => string {
  const { formatDateTime: fmt } = useDisplayPreferences();
  return fmt;
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }): ReactElement {
  const [preferences, setPreferencesState] = useState<DisplayPreferences>(() =>
    readStoredDisplayPreferences(),
  );

  const setPreferences = useCallback((next: DisplayPreferences) => {
    writeStoredDisplayPreferences(next);
    setPreferencesState(next);
  }, []);

  const patchPreferences = useCallback((patch: Partial<DisplayPreferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...patch };
      writeStoredDisplayPreferences(next);
      return next;
    });
  }, []);

  const effectivePreferences = useMemo(() => resolveDisplayPreferences(preferences), [preferences]);

  const formatDateTimeBound = useCallback(
    (value: string | Date | number | null | undefined) => formatDateTime(value, preferences),
    [preferences],
  );

  const value = useMemo<DisplayPreferencesContextValue>(
    () => ({
      preferences,
      effectivePreferences,
      setPreferences,
      patchPreferences,
      formatDateTime: formatDateTimeBound,
    }),
    [preferences, effectivePreferences, setPreferences, patchPreferences, formatDateTimeBound],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}
