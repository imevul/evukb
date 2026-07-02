import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from './cn.js';

/**
 * Shared control classes so raw `<input>`/`<select>` elements in app forms match
 * the Input/Textarea primitives without wrapping every element.
 */
export const FORM_CONTROL_CLASS =
  'flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const FORM_SELECT_CLASS = cn(FORM_CONTROL_CLASS, 'cursor-pointer');

export const FORM_TEXTAREA_CLASS =
  'w-full min-h-20 resize-y rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        FORM_CONTROL_CLASS,
        invalid && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        FORM_TEXTAREA_CLASS,
        invalid && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  );
});

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      // biome-ignore lint/a11y/noLabelWithoutControl: reusable primitive; consumers supply htmlFor and text content.
      <label ref={ref} className={cn('text-sm font-medium leading-none', className)} {...props} />
    );
  },
);
