import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon, X } from 'lucide-react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import { cn } from './cn.js';

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: 'border-secondary/40 bg-secondary/10 text-foreground [&_svg]:text-secondary',
  warning: 'border-warning/40 bg-warning/10 text-foreground [&_svg]:text-warning',
  danger: 'border-destructive/40 bg-destructive/10 text-foreground [&_svg]:text-destructive',
  success: 'border-success/40 bg-success/10 text-foreground [&_svg]:text-success',
};

const VARIANT_ICON: Record<AlertVariant, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle2,
};

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: ReactNode;
  icon?: boolean;
  /** When provided, renders a dismiss (X) button that calls this handler. */
  onDismiss?: () => void;
  /** Render title in a <details> summary; body is hidden until expanded. */
  collapsible?: boolean;
  /** Only when collapsible; defaults to false (collapsed). */
  defaultExpanded?: boolean;
};

/**
 * Banner/callout with a semantic variant. Fixes ad-hoc banner spacing by owning
 * the icon + title + body layout in one place. Pass `onDismiss` for lightweight
 * dismissible feedback (e.g. success notices after create/save).
 */
export function Alert({
  variant = 'info',
  title,
  icon = true,
  onDismiss,
  collapsible = false,
  defaultExpanded = false,
  className,
  children,
  ...props
}: AlertProps): ReactElement {
  const Icon = VARIANT_ICON[variant];

  if (collapsible) {
    return (
      <details
        className={cn('group rounded-lg border text-sm', VARIANT_CLASS[variant], className)}
        {...(defaultExpanded ? { open: true } : {})}
      >
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
          {icon ? <Icon aria-hidden /> : null}
          {title ? (
            <span className="min-w-0 flex-1 font-semibold leading-none">{title}</span>
          ) : null}
        </summary>
        {children ? (
          <div className="space-y-1 px-4 pb-4 pl-11 leading-relaxed text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
            {children}
          </div>
        ) : null}
      </details>
    );
  }

  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-lg border p-4 text-sm [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:mt-0.5',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {icon ? <Icon aria-hidden /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-semibold leading-none">{title}</p> : null}
        {children ? (
          <div className="space-y-1 leading-relaxed text-muted-foreground">{children}</div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          aria-label="Dismiss"
          className="-m-1 shrink-0 self-start rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
