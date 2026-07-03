import type { DisplayPreferences, EffectiveDisplayPreferences } from './display-preferences.js';
import { resolveDisplayPreferences } from './display-preferences.js';

function parseDate(value: string | Date | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function datePartsInZone(
  date: Date,
  timeZone: string,
): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { day: get('day'), month: get('month'), year: get('year') };
}

function formatDatePart(date: Date, prefs: EffectiveDisplayPreferences): string {
  if (prefs.dateFormat === 'locale') {
    return new Intl.DateTimeFormat(prefs.locale, {
      timeZone: prefs.timeZone,
      dateStyle: 'short',
    }).format(date);
  }

  const { day, month, year } = datePartsInZone(date, prefs.timeZone);

  switch (prefs.dateFormat) {
    case 'dmy_dot':
      return `${day}.${month}.${year}`;
    case 'mdy_slash':
      return `${month}/${day}/${year}`;
    case 'dmy_slash':
      return `${day}/${month}/${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/** Format an instant for display using browser display preferences. */
export function formatDateTime(
  value: string | Date | number | null | undefined,
  prefs: DisplayPreferences,
): string {
  if (value == null) return '—';
  const date = parseDate(value);
  if (!date) return '—';

  const effective = resolveDisplayPreferences(prefs);
  const datePart = formatDatePart(date, effective);
  const timePart = new Intl.DateTimeFormat(effective.locale, {
    timeZone: effective.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: effective.timeFormat === '12h',
  }).format(date);

  return `${datePart}, ${timePart}`;
}
