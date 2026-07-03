import { type ReactElement, useMemo } from 'react';

import { FORM_SELECT_CLASS, Label } from '../form.js';
import { Card, CardContent, CardHeader, CardTitle } from '../primitives.js';
import { useDisplayPreferences } from './DisplayPreferencesProvider.js';
import {
  COMMON_LOCALES,
  COMMON_TIME_ZONES,
  DATE_FORMAT_OPTIONS,
  type DateFormatPreference,
  type LocalePreference,
  SYSTEM_SETTING,
  type TimeFormatPreference,
  type TimeZonePreference,
} from './display-preferences.js';

export function DisplayPreferencesSettings(): ReactElement {
  const { preferences, effectivePreferences, patchPreferences, formatDateTime } =
    useDisplayPreferences();

  const timeZoneOptions = useMemo(() => {
    const zones = new Set<string>(COMMON_TIME_ZONES);
    if (preferences.timeZone !== SYSTEM_SETTING) {
      zones.add(preferences.timeZone);
    }
    zones.add(effectivePreferences.timeZone);
    return [...zones];
  }, [preferences.timeZone, effectivePreferences.timeZone]);

  const localeOptions = useMemo(() => {
    const locales = [...COMMON_LOCALES];
    if (
      preferences.locale !== SYSTEM_SETTING &&
      !locales.some((loc) => loc.value === preferences.locale)
    ) {
      locales.push({ value: preferences.locale, label: preferences.locale });
    }
    if (!locales.some((loc) => loc.value === effectivePreferences.locale)) {
      locales.push({
        value: effectivePreferences.locale,
        label: effectivePreferences.locale,
      });
    }
    return locales;
  }, [preferences.locale, effectivePreferences.locale]);

  const preview = formatDateTime(new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date &amp; time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <p className="text-sm text-muted-foreground">
          Controls how timestamps appear across the UI. Stored in this browser. Choose{' '}
          <strong>System setting</strong> on any field to follow your browser/OS for that value
          only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="display-time-format">Time format</Label>
            <select
              id="display-time-format"
              className={FORM_SELECT_CLASS}
              value={preferences.timeFormat}
              onChange={(e) =>
                patchPreferences({ timeFormat: e.target.value as TimeFormatPreference })
              }
            >
              <option value={SYSTEM_SETTING}>System setting</option>
              <option value="24h">24-hour</option>
              <option value="12h">12-hour (AM/PM)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-date-format">Date format</Label>
            <select
              id="display-date-format"
              className={FORM_SELECT_CLASS}
              value={preferences.dateFormat}
              onChange={(e) =>
                patchPreferences({ dateFormat: e.target.value as DateFormatPreference })
              }
            >
              <option value={SYSTEM_SETTING}>System setting</option>
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-timezone">Timezone</Label>
            <select
              id="display-timezone"
              className={FORM_SELECT_CLASS}
              value={preferences.timeZone}
              onChange={(e) => patchPreferences({ timeZone: e.target.value as TimeZonePreference })}
            >
              <option value={SYSTEM_SETTING}>System setting</option>
              {timeZoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-locale">Locale</Label>
            <select
              id="display-locale"
              className={FORM_SELECT_CLASS}
              value={preferences.locale}
              onChange={(e) => patchPreferences({ locale: e.target.value as LocalePreference })}
            >
              <option value={SYSTEM_SETTING}>System setting</option>
              {localeOptions.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Preview: <span className="font-mono text-foreground">{preview}</span>
          {' · '}
          <span className="font-mono text-foreground">{effectivePreferences.timeZone}</span>
          {' · '}
          <span className="font-mono text-foreground">{effectivePreferences.locale}</span>
        </p>
      </CardContent>
    </Card>
  );
}
