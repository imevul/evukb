export const SYSTEM_SETTING = 'system' as const;

export type ResolvedTimeFormat = '12h' | '24h';

/** Fixed date layouts; `locale` → locale short date style. */
export type DateFormat = 'iso' | 'dmy_dot' | 'mdy_slash' | 'dmy_slash' | 'locale';

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'iso', label: 'yyyy-mm-dd' },
  { value: 'dmy_dot', label: 'dd.mm.yyyy' },
  { value: 'mdy_slash', label: 'mm/dd/yyyy' },
  { value: 'dmy_slash', label: 'dd/mm/yyyy' },
  { value: 'locale', label: 'Locale default' },
];

const VALID_DATE_FORMATS = new Set<DateFormat>(DATE_FORMAT_OPTIONS.map((o) => o.value));

export type TimeFormatPreference = typeof SYSTEM_SETTING | ResolvedTimeFormat;
export type DateFormatPreference = typeof SYSTEM_SETTING | DateFormat;
export type TimeZonePreference = typeof SYSTEM_SETTING | string;
export type LocalePreference = typeof SYSTEM_SETTING | string;

export type DisplayPreferences = {
  timeFormat: TimeFormatPreference;
  timeZone: TimeZonePreference;
  locale: LocalePreference;
  dateFormat: DateFormatPreference;
};

/** Resolved values used for formatting (system choices expanded). */
export type EffectiveDisplayPreferences = {
  timeFormat: ResolvedTimeFormat;
  timeZone: string;
  locale: string;
  dateFormat: DateFormat;
};

export const DISPLAY_PREFERENCES_STORAGE_KEY = 'evukb_display_preferences';

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  timeFormat: SYSTEM_SETTING,
  timeZone: SYSTEM_SETTING,
  locale: SYSTEM_SETTING,
  dateFormat: SYSTEM_SETTING,
};

/** Explicit custom prefs for tests. */
export const EXAMPLE_CUSTOM_DISPLAY_PREFERENCES: DisplayPreferences = {
  timeFormat: '24h',
  timeZone: 'Europe/Oslo',
  locale: 'nb-NO',
  dateFormat: 'iso',
};

export const COMMON_TIME_ZONES = [
  'Europe/Oslo',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Stockholm',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

export const COMMON_LOCALES: { value: string; label: string }[] = [
  { value: 'nb-NO', label: 'Norwegian (nb-NO)' },
  { value: 'en-GB', label: 'English UK (en-GB)' },
  { value: 'en-US', label: 'English US (en-US)' },
  { value: 'sv-SE', label: 'Swedish (sv-SE)' },
  { value: 'de-DE', label: 'German (de-DE)' },
  { value: 'fr-FR', label: 'French (fr-FR)' },
];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getSystemLocale(): string {
  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

export function getSystemTimeZone(): string {
  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
}

/** Infer 12h vs 24h from how the locale formats an afternoon hour. */
export function detectSystemTimeFormat(locale = getSystemLocale()): ResolvedTimeFormat {
  const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).formatToParts(
    new Date(2020, 0, 1, 13, 0, 0),
  );
  return parts.some((p) => p.type === 'dayPeriod') ? '12h' : '24h';
}

export function resolveDisplayPreferences(prefs: DisplayPreferences): EffectiveDisplayPreferences {
  const locale = prefs.locale === SYSTEM_SETTING ? getSystemLocale() : prefs.locale;
  const timeZone = prefs.timeZone === SYSTEM_SETTING ? getSystemTimeZone() : prefs.timeZone;
  const timeFormat =
    prefs.timeFormat === SYSTEM_SETTING ? detectSystemTimeFormat(locale) : prefs.timeFormat;
  const dateFormat = prefs.dateFormat === SYSTEM_SETTING ? 'locale' : prefs.dateFormat;
  return { locale, timeZone, timeFormat, dateFormat };
}

function parseTimeFormat(raw: unknown): TimeFormatPreference {
  if (raw === SYSTEM_SETTING || raw === '12h' || raw === '24h') return raw;
  return SYSTEM_SETTING;
}

function parseDateFormat(raw: unknown): DateFormatPreference {
  if (raw === SYSTEM_SETTING) return SYSTEM_SETTING;
  if (typeof raw === 'string' && VALID_DATE_FORMATS.has(raw as DateFormat)) {
    return raw as DateFormat;
  }
  return SYSTEM_SETTING;
}

function parseTimeZone(raw: unknown): TimeZonePreference {
  if (raw === SYSTEM_SETTING) return SYSTEM_SETTING;
  if (typeof raw === 'string' && isValidTimeZone(raw)) return raw;
  return SYSTEM_SETTING;
}

function parseLocale(raw: unknown): LocalePreference {
  if (raw === SYSTEM_SETTING) return SYSTEM_SETTING;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return SYSTEM_SETTING;
}

function parseStoredPreferences(raw: unknown): DisplayPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
  const o = raw as Record<string, unknown>;

  if (o.useSystemDefaults === true) {
    return DEFAULT_DISPLAY_PREFERENCES;
  }

  return {
    timeFormat: parseTimeFormat(o.timeFormat),
    timeZone: parseTimeZone(o.timeZone),
    locale: parseLocale(o.locale),
    dateFormat: parseDateFormat(o.dateFormat),
  };
}

export function readStoredDisplayPreferences(): DisplayPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY_PREFERENCES;
    return parseStoredPreferences(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

export function writeStoredDisplayPreferences(prefs: DisplayPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / disabled storage */
  }
}
