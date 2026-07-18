import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from './cn.js';

export type StatusTone = 'success' | 'danger' | 'warning' | 'active' | 'neutral';

const SUCCESS = new Set([
  'completed',
  'succeeded',
  'success',
  'ok',
  'approved',
  'applied',
  'accepted',
  'enabled',
  'ready',
  'healthy',
  'pass',
  'passed',
  'allowed',
  'granted',
  'indexed',
]);

const DANGER = new Set([
  'failed',
  'error',
  'denied',
  'rejected',
  'blocked',
  'cancelled',
  'canceled',
  'not-configured',
  'not_configured',
  'missing',
  'disabled',
  'discarded',
]);

const WARNING = new Set([
  'queued',
  'pending',
  'pending_review',
  'awaiting_approval',
  'waiting',
  'scheduled',
  'idle',
  'partial',
  'unknown',
  'stale',
  'degraded',
]);

const ACTIVE = new Set(['running', 'in_progress', 'processing', 'active', 'indexing', 'syncing']);

export const STATUS_TONE_CLASS: Record<Exclude<StatusTone, 'neutral'>, string> = {
  success: 'border-success/30 bg-success/15 text-success',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  active: 'border-secondary/40 bg-secondary/15 text-secondary',
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Map a domain status string to a semantic badge tone. */
export function statusTone(status: string): StatusTone {
  const normalized = normalizeStatus(status);
  if (SUCCESS.has(normalized)) return 'success';
  if (DANGER.has(normalized)) return 'danger';
  if (ACTIVE.has(normalized)) return 'active';
  if (WARNING.has(normalized)) return 'warning';
  if (
    normalized.includes('fail') ||
    normalized.includes('denied') ||
    normalized.includes('error')
  ) {
    return 'danger';
  }
  if (
    normalized.includes('complete') ||
    normalized.includes('success') ||
    normalized.includes('approv')
  ) {
    return 'success';
  }
  if (normalized.includes('run') && normalized.endsWith('ing')) return 'active';
  if (normalized.includes('queue') || normalized.includes('pend') || normalized.includes('wait')) {
    return 'warning';
  }
  return 'neutral';
}

const BADGE_BASE = 'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps): ReactElement {
  const toneClass =
    tone === 'neutral'
      ? 'border-border bg-background/50 text-foreground dark:bg-background/20'
      : STATUS_TONE_CLASS[tone];
  return <span className={cn(BADGE_BASE, toneClass, className)} {...props} />;
}

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: string;
  label?: string;
};

/** Badge whose tone is derived from a domain status string. */
export function StatusBadge({
  status,
  label,
  className,
  ...props
}: StatusBadgeProps): ReactElement {
  return (
    <Badge tone={statusTone(status)} className={className} {...props}>
      {label ?? status}
    </Badge>
  );
}
