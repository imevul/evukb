import type { ReactNode } from 'react';

import { Badge, type StatusTone } from './badge.js';

export type EvuKbShellProps = {
  children?: ReactNode;
  eyebrow?: string;
  title: string;
};

export function EvuKbShell({ children, eyebrow, title }: EvuKbShellProps) {
  return (
    <main className="flex flex-col gap-4">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <div className="flex flex-col gap-4">{children}</div> : null}
    </main>
  );
}

export type StatusPillProps = {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

/**
 * Backwards-compatible pill. New code should prefer `Badge`/`StatusBadge`.
 */
export function StatusPill({ children, tone = 'neutral' }: StatusPillProps) {
  const mapped: StatusTone = tone === 'neutral' ? 'neutral' : tone;
  return <Badge tone={mapped}>{children}</Badge>;
}
