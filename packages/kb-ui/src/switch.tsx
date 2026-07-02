import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from './cn.js';

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'role' | 'type' | 'onClick' | 'onChange' | 'children' | 'defaultChecked' | 'aria-checked'
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * iOS-style track + sliding thumb. The default boolean control across EvuKB
 * (see DESIGN.md). Always pair with a visible label or `aria-label`.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, checked, onCheckedChange, disabled, id, ...rest },
  ref,
) {
  return (
    <button
      id={id}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'on' : 'off'}
      disabled={disabled}
      {...rest}
      className={cn(
        'group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        !disabled && checked && 'bg-primary',
        !disabled && !checked && 'bg-muted',
        disabled &&
          checked &&
          'cursor-not-allowed border-border/60 bg-primary/90 shadow-sm ring-1 ring-border',
        disabled &&
          !checked &&
          'cursor-not-allowed border-border/80 bg-muted-foreground/35 shadow-sm ring-1 ring-border/90',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        onCheckedChange?.(!checked);
      }}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background shadow ring-1 ring-border transition-[left] duration-200 ease-out',
          'group-disabled:ring-2 group-disabled:ring-foreground/30',
          'group-data-[state=off]:group-disabled:bg-muted-foreground/25',
          checked ? 'left-[1.375rem]' : 'left-0.5',
        )}
      />
    </button>
  );
});
