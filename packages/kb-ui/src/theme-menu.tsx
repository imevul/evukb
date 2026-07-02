import type { ChangeEvent, ReactElement } from 'react';

import { FORM_SELECT_CLASS } from './form.js';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemeMenuProps = {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
};

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeMenu({ value, onChange }: ThemeMenuProps): ReactElement {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      Theme
      <select
        className={FORM_SELECT_CLASS}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value as ThemePreference)
        }
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
