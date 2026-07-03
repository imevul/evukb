import { describe, expect, it } from 'vitest';

import {
  detectSystemTimeFormat,
  EXAMPLE_CUSTOM_DISPLAY_PREFERENCES,
  resolveDisplayPreferences,
  SYSTEM_SETTING,
} from '../src/display/display-preferences.js';
import { formatDateTime } from '../src/display/format-date-time.js';

describe('formatDateTime', () => {
  it('formats ISO date with 24h time in Europe/Oslo', () => {
    const prefs = { ...EXAMPLE_CUSTOM_DISPLAY_PREFERENCES };
    const result = formatDateTime('2026-06-14T17:15:47.000Z', prefs);
    expect(result).toMatch(/^2026-06-14, \d{2}:\d{2}:\d{2}$/);
    expect(result).not.toMatch(/AM|PM/i);
    expect(result).toContain('19:15:47');
  });

  it('uses 12h time when configured', () => {
    const prefs = {
      ...EXAMPLE_CUSTOM_DISPLAY_PREFERENCES,
      timeFormat: '12h' as const,
      locale: 'en-US',
    };
    const result = formatDateTime('2026-06-14T17:15:47.000Z', prefs);
    expect(result).toMatch(/PM/i);
  });

  it('returns em dash for nullish values', () => {
    expect(formatDateTime(null, EXAMPLE_CUSTOM_DISPLAY_PREFERENCES)).toBe('—');
    expect(formatDateTime(undefined, EXAMPLE_CUSTOM_DISPLAY_PREFERENCES)).toBe('—');
  });

  it('formats dd.mm.yyyy, mm/dd/yyyy, and dd/mm/yyyy in target timezone', () => {
    const instant = '2026-06-14T17:15:47.000Z';
    const base = { ...EXAMPLE_CUSTOM_DISPLAY_PREFERENCES, timeFormat: '24h' as const };

    expect(formatDateTime(instant, { ...base, dateFormat: 'dmy_dot' })).toMatch(
      /^14\.06\.2026, 19:15:47$/,
    );
    expect(formatDateTime(instant, { ...base, dateFormat: 'mdy_slash' })).toMatch(
      /^06\/14\/2026, 19:15:47$/,
    );
    expect(formatDateTime(instant, { ...base, dateFormat: 'dmy_slash' })).toMatch(
      /^14\/06\/2026, 19:15:47$/,
    );
  });
});

describe('resolveDisplayPreferences', () => {
  it('resolves each system field independently', () => {
    const resolved = resolveDisplayPreferences({
      timeFormat: SYSTEM_SETTING,
      timeZone: 'Europe/Oslo',
      locale: 'en-US',
      dateFormat: 'iso',
    });
    expect(resolved.timeZone).toBe('Europe/Oslo');
    expect(resolved.locale).toBe('en-US');
    expect(resolved.dateFormat).toBe('iso');
    expect(resolved.timeFormat).toBe('12h');
  });

  it('uses locale date format when date format is system', () => {
    const resolved = resolveDisplayPreferences({
      timeFormat: '24h',
      timeZone: 'Europe/Oslo',
      locale: 'nb-NO',
      dateFormat: SYSTEM_SETTING,
    });
    expect(resolved.dateFormat).toBe('locale');
  });

  it('preserves explicit custom values', () => {
    const resolved = resolveDisplayPreferences(EXAMPLE_CUSTOM_DISPLAY_PREFERENCES);
    expect(resolved).toEqual({
      timeFormat: '24h',
      timeZone: 'Europe/Oslo',
      locale: 'nb-NO',
      dateFormat: 'iso',
    });
  });
});

describe('detectSystemTimeFormat', () => {
  it('detects 12h for en-US and 24h for de-DE', () => {
    expect(detectSystemTimeFormat('en-US')).toBe('12h');
    expect(detectSystemTimeFormat('de-DE')).toBe('24h');
  });
});
