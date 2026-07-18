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
        'group relative inline-flex h-[1.375rem] w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        !disabled && checked && 'border-transparent bg-primary',
        !disabled && !checked && 'border-border bg-muted',
        disabled && checked && 'cursor-not-allowed border-transparent bg-primary/90 opacity-50',
        disabled && !checked && 'cursor-not-allowed border-border bg-muted opacity-50',
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
          'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full shadow transition-[left,background-color,opacity] duration-150 ease-out',
          checked
            ? 'left-[1.125rem] bg-primary-foreground opacity-100'
            : 'left-0.5 bg-foreground opacity-70',
        )}
      />
    </button>
  );
});
