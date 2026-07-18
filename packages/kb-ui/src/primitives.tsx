import { cva, type VariantProps } from 'class-variance-authority';
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from './cn.js';

/**
 * Evu Theme button surfaces: outline/default stay elevated `--card` chips so they
 * never read as input wells or badges inside muted/55 groups.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-primary-foreground shadow-sm hover:brightness-105',
        default:
          'border-foreground/25 bg-card text-foreground shadow-[0_1px_2px_hsl(220_10%_4%/0.16)] hover:border-foreground/35 hover:bg-muted/65 dark:border-foreground/30 dark:shadow-[0_1px_2px_rgb(0_0_0/0.55)] dark:hover:border-foreground/45 dark:hover:bg-muted/80',
        outline:
          'border-foreground/25 bg-card text-foreground shadow-[0_1px_2px_hsl(220_10%_4%/0.16)] hover:border-foreground/35 hover:bg-muted/65 dark:border-foreground/30 dark:shadow-[0_1px_2px_rgb(0_0_0/0.55)] dark:hover:border-foreground/45 dark:hover:bg-muted/80',
        secondary:
          'border-secondary/40 bg-secondary/18 text-secondary shadow-sm hover:border-secondary/55 hover:bg-secondary/28',
        quiet:
          'border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted/55 hover:text-foreground',
        ghost:
          'border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted/55 hover:text-foreground',
        danger:
          'border-transparent bg-destructive text-destructive-foreground shadow-sm hover:brightness-105',
        dangerOutline:
          'border-destructive/45 bg-card text-destructive shadow-[0_1px_2px_hsl(220_10%_4%/0.16)] hover:border-destructive/65 hover:bg-destructive/12 dark:border-destructive/55 dark:shadow-[0_1px_2px_rgb(0_0_0/0.55)] dark:hover:bg-destructive/15',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-sm hover:brightness-105',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3 ref={ref} className={cn('text-lg font-semibold leading-none', className)} {...props} />
    );
  },
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />;
  },
);

export type FieldProps = {
  children: ReactNode;
  className?: string;
};

export function Field({ children, className }: FieldProps): ReactElement {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}

export type PageTitleProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Route-level title. Renders an `<h1>` — use at most once per route; section
 * headings below it should be `<h2>`/`<h3>`.
 */
export function PageTitle({ children, className }: PageTitleProps): ReactElement {
  return <h1 className={cn('text-2xl font-semibold tracking-tight', className)}>{children}</h1>;
}

export type PageToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function PageToolbar({ children, className }: PageToolbarProps): ReactElement {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      {children}
    </div>
  );
}
