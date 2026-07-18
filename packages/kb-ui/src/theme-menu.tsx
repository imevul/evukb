import type { ReactElement } from 'react';

import { cn } from './cn.js';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemeMenuProps = {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
  className?: string;
};

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Segmented light / dark / system control (Evu `.evu-theme-menu` pattern).
 */
export function ThemeMenu({ value, onChange, className }: ThemeMenuProps): ReactElement {
  return (
    <fieldset
      aria-label="Color scheme"
      className={cn(
        'm-0 inline-flex overflow-hidden rounded-md border border-border bg-card p-0',
        className,
      )}
    >
      <legend className="sr-only">Color scheme</legend>
      {OPTIONS.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            className={cn(
              'h-7 border-r border-border px-2.5 text-xs font-medium last:border-r-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              pressed
                ? 'bg-primary/20 text-primary'
                : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
